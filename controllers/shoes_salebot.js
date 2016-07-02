'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var validator = require("email-validator");
var request = require('request');
var JSONbig = require('json-bigint');
var server = express();
var EventEmitter = require('events');
var emitter = new EventEmitter();

var config = require("../config/config.js");
var common = require("../util/common");
var logger = require("../util/logger.js");

var gModelFactory = require("../dal/model_factory.js");
var gProductFinder = require('../dal/product_finder.js');

// Refactory code
var SessionManager = require("../dal/session_manager.js");
var sessionManager = new SessionManager();

var ParserFactory = require("../processors/user_intent_parser_factory.js");
var parserFactory = new ParserFactory();
var intentParser = null;

var FBMessenger = require("../io/fbmessenger.js");
var fbMessenger = new FBMessenger();

var gStoreId = "";
var gHomepage = "";
var gStoreConfig = {};

var gAiUsingFlag = false;

var async = require("async");

// Keyword - results
var searchMap = {};

var storeId = -1;

function createAndSendOrderToFB(session, callback) {
    gProductFinder.getOrderItems(session.last_invoice.id, function(items) {
        var sub_total = 0;
        var invoice_items = [];
        var length = items[0].Invoice.dataValues.creation_date.length;
        var delta = length - 10;
        if (delta > 0) {
            session.last_invoice.creation_date = items[0].Invoice.dataValues
                .creation_date.slice(0, -1 * delta);
        }
        var invoice_details = session.last_invoice;

        for (var i = 0; i < items.length; i++) {
            var title = items[i].Product.dataValues.title;
            var price = items[i].Product.dataValues.price;
            var subtitle = "Mô tả SP: Màu " + common.get_color_vn(items[i].Color.dataValues.name) + " và size " + items[i].Size.dataValues.value;
            var quantity = items[i].dataValues.quantity;
            var thumbnail_url = items[i].Product.dataValues.thumbnail;
            var jsonitem = fbMessenger.createOrderItemElement(title, subtitle,
                price, quantity, thumbnail_url);
            invoice_items.push(jsonitem);
            sub_total += (price * quantity);
        }

        var invoice_summary = fbMessenger.generate_invoice_summary(sub_total / 100, 200);
        var invoice_adjustments = {};
        fbMessenger.sendReceiptMessage(session.fbid, invoice_items,
            invoice_details, invoice_summary, invoice_adjustments, callback);
    });
}

function createAndSendOrderToStore(session, callback) {
    gProductFinder.getOrderItems(session.last_invoice.id, function(items) {
        for (var i = 0; i < items.length; i++) {
            var order = gStoreConfig.order_form;
            request({
                url: gHomepage,
                method: 'POST',
            }, function(error, response, body) {
                if (error) {
                    logger.error('Error sending message: ' + error.stack);
                } else if (response.body.error) {
                    logger.error('Error: ' + JSON.stringify(response.body.error));
                } else {
                    if (callback != null) {
                        callback();
                    }
                }
            });
        }
    });
}

function sendCategorySearchResultsToFB(session, categories) {
    if (categories.length > 0) {
        async.series([
            function(callback) {
                // fbMessenger.sendTextMessage(session.fbid, "Bạn xem danh mục sản phẩm bên dưới nhé");
                callback(null);
            },
            function sendResultsToFB() {
                var foundCategories = null;
                var results = [];
                if (Array.isArray(categories)) {
                    foundCategories = categories;
                } else {
                    foundCategories = [];
                    foundCategories.push(categories);
                }
                fbMessenger.sendCategoriesElements(session.fbid, foundCategories);
                if (foundCategories.length == 1) {
                    session.last_product.categoryid = foundCategories[0].id;
                }
            }
        ]);
    } else {}
}

function sendProductSearchResultsToFB(session, products) {
    var keys = Object.keys(products);
    if (keys.length > 0) {
        async.series([
            function(callback) {
                // fbMessenger.sendTextMessage(session.fbid, common.notify_product_found);
                callback(null);
            },
            function(callback) {
                fbMessenger.sendTextMessage(session.fbid, common.notify_product_search);
                callback(null);
            },
            function sendResultsToFB() {
                var found_products = null;
                var results = [];
                if (Array.isArray(products)) {
                    found_products = products;
                } else {
                    found_products = [];
                    found_products.push(products);
                }
                fbMessenger.sendProductElements(session.fbid, found_products);
                if (found_products.length == 1) {
                    session.last_product.id = found_products[0].id;
                }
            }
        ]);
    } else {
        showSimilarProductSuggestion();
    }
}

function searchAndConfirmAddress(session, destination, callback) {
    // Handle a text message from this sender
    //getUserProfile(sender, function () {
    common.searchAddress(destination, function(result) {
        var length = 1; //result.length;
        for (var i = 0; i < length; i++) {
            logger.info("Full address: " + result[i].formattedAddress);
            //logger.info("City = " + result[i].city);
            //logger.info("Province / State = " + result[i].administrativeLevels.level1long);
            fbMessenger.sendAddressConfirmMessage(session.fbid, result[i].formattedAddress);
            callback(result[i].formattedAddress);
        }
    });
    //});
}


function getAvailableColorMsg(show_color, colors, reference) {
    var availableColorMessage = "";
    var referColorsString = reference.toString().replaceAll(" ", '');
    referColorsString = referColorsString.replaceAll(",", '');
    referColorsString = referColorsString.toLowerCase();

    if (show_color) {
        availableColorMessage = "\n - Màu sắc: ";
        var matchColorStr = "";
        var availableColors = "";
        if (colors != null && colors.length > 0) {
            for (var i = 0; i < colors.length; i++) {
                if (referColorsString.indexOf(colors[i].name) >= 0) {
                    matchColorStr += common.get_color_vn(colors[i].name) + ", ";
                } else {}
                availableColors += common.get_color_vn(colors[i].name) + ", ";
            }
            if (matchColorStr === "") {
                availableColorMessage = "Màu sắc bạn tìm hiện tại không còn.";
                availableColorMessage += "Bạn vui lòng xem màu còn hàng bên dưới nhé: \n";
                availableColorMessage += " - " + availableColors.slice(0, -2);

            } else {
                availableColorMessage += matchColorStr.slice(0, -2) + " còn hàng nhé";
            }
        } else {
            availableColorMessage += common.status_updating;
        }
    }
    return availableColorMessage;
}

function getAvailableSizeMsg(show_size, sizes, reference) {
    var availableSizesMesage = "";
    var referSizesString = reference.toString().replaceAll(" ", '');
    referSizesString = referSizesString.replaceAll(",", '');
    referSizesString = referSizesString.toLowerCase();
    if (show_size) {
        availableSizesMesage = "\n- Size: ";
        var matchSizes = "";
        var availableSizes = "";
        if (sizes != null && sizes.length > 0) {
            for (var i = 0; i < (sizes.length - 1); i++) {
                if (referSizesString.indexOf(sizes[i].value) >= 0) {
                    matchSizes += sizes[i].value + ", ";
                } else {}
                availableSizes += sizes[i].value + ", ";
            }
            if (matchSizes === "") {
                availableSizesMesage = "Size bạn tìm hiện tại không còn.";
                availableSizesMesage += "Bạn vui lòng xem size còn hàng bên dưới nhé: \n";
                availableSizesMesage += "- " + availableSizes.slice(0, -2);
            } else {
                availableSizesMesage += matchSizes.slice(0, -2) + " còn hàng nhé";
            }
        } else {
            availableSizesMesage += common.status_updating;
        }
    }
    return availableSizesMesage;
}

function showAvailableColorNsize(session, show_color, show_size, show_photo) {
    var productId = session.last_product.id;
    gProductFinder.getColorsNSizeNPhotos(productId,
        function(colors, sizes, photos) {
            var available_colors = getAvailableColorMsg(show_color, colors, JSON.stringify(colors));
            var available_sizes = getAvailableSizeMsg(show_size, sizes, JSON.stringify(sizes));
            logger.info("Product id = " + productId + " \nDetails - " + available_colors + available_sizes);
            if (show_photo && photos.length > 0) {
                fbMessenger.sendProductPhotoElements(session.fbid, session.last_product.id,
                    session.last_product.title, available_colors + available_sizes, photos);
            } else {
                fbMessenger.sendTextMessage(session.fbid,
                    session.last_product.title + available_colors + available_sizes);
            }
        });
}

// =================================================================
// Methods for search product
// =================================================================
function showSimilarProductSuggestion(session) {
    // send suggestion for products in same category
    async.series([
        function(callback) {
            fbMessenger.sendTextMessage(session.fbid, common.notify_product_similar, function() {
                callback(null);
            });
        },
        // function(callback) {
        //     fbMessenger.sendTextMessage(session.fbid, common.notify_product_similar, function() {
        //         callback(null);
        //     });
        // },
        function(callback) {
            if (session.last_product.categoryid >= 0) {
                findProductByCategory(session);
            } else {
                findCategories(session);
            }
        }
    ]);
}

function findProductByThumbLink(session, thumbLink) {
    gProductFinder.findProductByThumbnail(gHomepage, thumbLink, function(product) {
        sendProductSearchResultsToFB(session, product);
        session.last_product.categoryid = product.CategoryId;
    });
}

function findProductByDetailLink(session, link) {
    gProductFinder.findProductByLink(session.storeid, link, function(product) {
        sendProductSearchResultsToFB(session, product);
        session.last_product.categoryid = product.CategoryId;
    });
}

function findProductByKeywords(session, keywords) {
    gProductFinder.findShoesByKeywords(session.storeid, keywords, function(products) {
        sendProductSearchResultsToFB(session, products);
    });
}

function findProductByCode(session, productCode) {
    gProductFinder.findProductByCode(session.storeid, productCode, function(product) {
        sendProductSearchResultsToFB(session, product);
        session.last_product.categoryid = product.CategoryId;
    });
}

function findProductByCategory(session) {
    gProductFinder.findProductsByCategory(session.storeid,
        session.last_product.categoryid,
        function(products) {
            sendProductSearchResultsToFB(session, products);
            if (Object.keys(products).length > 0) {
                session.last_product.categoryid = categoryid;
            }
        });
}

function findCategories(session) {
    gProductFinder.findCategoriesByStoreId(session.storeid, function(categories) {
        sendCategorySearchResultsToFB(session, categories);
    });
}

function doProductSearch(session, user_msg, user_msg_trans) {
    var result = common.extractValue(user_msg, gStoreConfig.product_code_pattern);
    if (common.isThumbUrl(user_msg)) {
        findProductByThumbLink(session, user_msg);
    } else if (common.isUrl(user_msg)) {
        findProductByDetailLink(session, user_msg);
    } else if (result != "") {
        findProductByCode(session, result);
    } else {
        findProductByKeywords(session, user_msg_trans);
    }
}

function doProductOrder(session, text) {
    var user_req_trans = text.latinise().toLowerCase();
    if (session.last_action == common.select_product) {
        if (session.last_invoice.id == -1) {
            gModelFactory.create_empty_invoice(session.fbid,
                function(invoice) {
                    session.last_invoice.id = invoice.id;
                });
        } else {}

        // Remove mua word to get color value
        var color_keyword = user_req_trans.replaceAll("mau", "").replaceAll(" ", "").trim();
        gProductFinder.checkProductByColor(session.last_product.id,
            color_keyword,
            function(color) {
                if (color != null) {
                    session.last_action = common.select_product_color;
                    session.last_product.color = color.id;
                    fbMessenger.sendTextMessage(session.fbid, common.pls_select_product_size, function() {
                        showAvailableColorNsize(session, false, true, false);
                    });
                } else {
                    logger.debug("Product not found");
                    fbMessenger.sendTextMessage(session.fbid, common.notify_color_notfound,
                        function() {
                            showAvailableColorNsize(session, true, false, false);
                        });
                }
            });
    } else if (session.last_action == common.select_product_color) {
        gProductFinder.checkProductBySize(session.last_product.id,
            text,
            function(size) {
                if (size != null) {
                    session.last_action = common.select_product_size;
                    session.last_product.size = size.id;
                    fbMessenger.sendTextMessage(session.fbid, common.pls_enter_quantity);
                } else {
                    fbMessenger.sendTextMessage(session.fbid, common.notify_size_notfound,
                        function() {
                            showAvailableColorNsize(session, false, true, false);
                        });
                }
            });
    } else if (session.last_action == common.select_product_size) {
        logger.debug("Order Quantity: " + text);
        gModelFactory.create_fashion_item(parseInt(text),
            session.last_invoice.id,
            session.last_product.id,
            session.last_product.color,
            session.last_product.size,
            function(saved_item) {
                logger.info("saved_item: " + saved_item);
            });

        session.last_action = common.say_search_continue_message;
        fbMessenger.sendPurchaseConfirmMessage(session.fbid, "Bạn muốn tiếp tục chọn sản phẩm hay đặt hàng ngay?");
    }
}

function doFillOrderDetails(session, text) {
    if (session.last_action == common.set_quantity) {
        logger.debug("Name: " + text);
        session.last_action = common.set_recipient_name;
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_phone);
        session.last_invoice.name = text;
    } else if (session.last_action == common.set_recipient_name) {
        logger.debug("Phone: " + text);
        session.last_action = common.set_phone;
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_address);
        session.last_invoice.phone = text;
    } else if (session.last_action == common.set_phone) {
        logger.debug("Address: " + text);
        searchAndConfirmAddress(session, text, function(result) {
            session.last_invoice.address = result;
        });
    } else if (session.last_action == common.set_address) {
        logger.debug("Email: " + text);
        var is_valid_email = validator.validate(text);
        if (is_valid_email) {
            session.last_invoice.email = text;
            session.last_action = common.set_delivery_date;
            fbMessenger.sendTextMessage(session.fbid, common.pls_enter_delivery_date);
        } else {
            fbMessenger.sendTextMessage(session.fbid, common.pls_enter_email);
        }
    } else if (session.last_action == common.set_email) {
        logger.debug("Delivery: " + text);
        session.last_invoice.delivery = text;
        session.last_action = common.set_delivery_date;
    } else if (session.last_action == common.set_delivery_date) {
        createAndSendOrderToFB(session, function() {
            fbMessenger.sendOrderConfirmMessage(session.fbid, "Xác nhận đơ hàng!");
        });
    } else {
        logger.info("Unknow action = " + text);
    }
}

function doCancelOrder(session) {
    var invoice_id = session.last_invoice.id;
    var status = "cancel";
    session.last_invoice.is_ordering = false;
    gModelFactory.cancel_invoice(invoice_id, status,
        function(invoice) {
            session.last_invoice.id = -1;
            session.last_product.id = -1;
            session.last_invoice.id = -1;
            session.last_invoice.status = "cancel";
        });
    fbMessenger.sendTextMessage(session.fbid, common.pls_reset_buying);
    session.last_action = common.say_greetings;
    fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);
}

//=====================================================================//
//================= Process FB Message=================================//
//=====================================================================//

function processTextEvent(session, user_msg) {
    var user_req_trans = user_msg.latinise().toLowerCase();
    var last_action_key = session.last_action;
    var last_action = common.sale_steps.get(last_action_key);
    var selectProductAction = common.sale_steps.get(common.select_product);
    var selectQuantityAction = common.sale_steps.get(common.set_quantity);
    var selectDeliveryDateAction = common.sale_steps.get(common.set_delivery_date);

    if (user_req_trans === common.action_terminate_order) {
        doCancelOrder(session);
    } else if (last_action_key === common.say_greetings) {
        doProductSearch(session, user_msg, user_req_trans);
    } else if ((last_action >= selectProductAction) && last_action < selectQuantityAction) {
        doProductOrder(session, user_msg);
    } else if ((last_action >= selectQuantityAction) && last_action <= selectDeliveryDateAction) {
        doFillOrderDetails(session, user_msg);
    } else {
        logger.error("Unknow message: " + user_msg);
    }
}

function processPostbackEvent(session, action_details) {
    var user_action = action_details.action;
    if (user_action.indexOf(common.action_view_details) >= 0) {
        sessionManager.setProductIdNTitle(session,
            action_details.id, action_details.title);
        showAvailableColorNsize(session, true, true, true);

    } else if (user_action.indexOf(common.action_order) >= 0) {
        sessionManager.setOrdeTrigerStatusInfo(session, true);
        sessionManager.setProductIdNTitle(session,
            action_details.id, action_details.title);
        sessionManager.setUserAction(session, common.select_product);
        fbMessenger.sendTextMessage(session.fbid, "     Bắt đầu đặt hàng\n" +
            common.pls_select_product_color,
            function() {
                showAvailableColorNsize(session, true, false, false);
            });

    } else if (session.last_invoice.is_ordering &&
        (user_action.indexOf(common.action_continue_search) >= 0)) {
        sessionManager.setUserAction(session, common.say_greetings);
        fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);

    } else if (user_action.indexOf(common.action_purchase) >= 0) {
        sessionManager.setUserAction(session, common.set_quantity);
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_name);

    } else if (user_action.indexOf(common.action_confirm_addr) >= 0) {
        sessionManager.setUserAction(session, common.set_address);
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_email);

    } else if (user_action.indexOf(common.action_retype_addr) >= 0) {
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_address);

    } else if (user_action.indexOf(common.action_confirm_order) >= 0) {
        sessionManager.setOrderStatusInfo(session, "confirm");
        gModelFactory.update_invoice(session.last_invoice, function(invoice) {
            logger.info(invoice);
            sessionManager.resetSession(session.fbid);
            fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);
        });

    } else if (user_action.indexOf(common.action_cancel_order) >= 0) {
        gModelFactory.cancel_invoice(session.last_invoice.id, "cancel", function(invoice) {
            if (invoice != null) {
                // user_sessions[session.sessionId] = initSession(session.fbid);
                sessionManager.resetSession(session.fbid);
                fbMessenger.sendTextMessage(session.fbid, common.say_greetings);
            }
        });
    } else if (user_action.indexOf(common.action_view_catgory) >= 0) {
        sessionManager.setCategoryId(session, action_details.id);
        findProductByCategory(session);
    } else {
        logger.error("Unknow action: " + JSON.stringify(action_details));
    }
}

function processEvent(event) {
    var sender = event.sender.id.toString();
    var receiver = event.recipient.id.toString();
    var currentSession = sessionManager.findOrCreateSession(storeId, receiver, sender);

    if (event.message) {
        if (event.message.text) {
            var text = event.message.text;
            var isURL = common.isUrl(text);
            if (!isURL) {
                var options = {
                    storeid: currentSession.storeid,
                    pageid: receiver,
                    fbid: sender,
                    productid: currentSession.last_product.id,
                    codePattern: gStoreConfig.product_code_pattern
                };

                intentParser.parse(text.latinise().toLowerCase(), options);
            } else {
                processTextEvent(currentSession, text);
            }
        } else if (event.message.attachments != null) {
            var attachments = event.message.attachments;
            // handle the case when user send an image for searching product
            for (var i = 0; i < attachments.length; i++) {
                if (attachments[i].type === 'image') {
                    processTextEvent(currentSession, attachments[i].payload.url);
                } else {
                    logger.info("Skipp to handle attachment");
                }
            }
        } else {

        }
    } else if (event.postback) {
        var postback = JSON.parse(event.postback.payload);
        var delta = event.timestamp - currentSession.timestamp;
        if (delta > 150 /*avoid double click*/ ) {
            currentSession.timestamp = event.timestamp;
            processPostbackEvent(currentSession, postback);
        } else {
            logger.info("Skipp to handle double click");
        }
    }
}

//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//
function initWebHook() {
    fbMessenger.doSubscribeRequest();

    server.use(bodyParser.text({
        type: 'application/json'
    }));

    server.use(bodyParser.urlencoded({
        extended: true
    }));

    server.get(config.bots.fb_webhook, function(req, res) {
        if (req.query['hub.verify_token'] == FB_VERIFY_TOKEN) {
            res.send(req.query['hub.challenge']);
            console.log("call get");
            setTimeout(function() {
                fbMessenger.doSubscribeRequest();
            }, 3000);
        } else {
            res.send('Error, wrong validation token');
        }
    });

    server.post(config.bots.fb_webhook, function(req, res) {
        try {
            var data = JSONbig.parse(req.body);
            var messaging_events = data.entry[0].messaging;
            for (var i = 0; i < messaging_events.length; i++) {
                var event = data.entry[0].messaging[i];
                processEvent(event);
            }
            return res.status(200).json({
                status: "ok"
            });
        } catch (err) {
            logger.error(err);
            return res.status(400).json({
                status: "error",
                error: err
            });
        }
    });

    server.listen(config.bots.port, function() {
        console.log('FB BOT ready to go!');
    });
}

function findLastSelectProduct(session, data, callback) {
    if (data.code != '') {
        gProductFinder.findProductByCode(session.storeid, data.code, function(product) {
            callback(product);
        });
    } else if (data.productid >= 0) {
        gProductFinder.findProductById(data.productid, function(product) {
            callback(product);
        });
    }
}

function extractComboPrice(productTitle, saleoffmsg) {
    var message = "";
    var prices = common.extractValues(productTitle, "\\d+");
    var malePrice = (prices.length >= 3) ? common.extractValues(prices[1], "\\d+") : 0;
    var femalePrice = (prices.length >= 3) ? common.extractValues(prices[2], "\\d+") : 0;
    var total = 0;
    if (prices.length === 3) {
        total = parseInt(malePrice) + parseInt(femalePrice);
    } else if (prices.length === 4) {
        total = prices[3];
    } else {
        total = 0;
    }
    message = "- 1 Combo (Nam + Nữ) " + " giá " + common.toCurrencyString(total * 1000, " VNĐ") + saleoffmsg;
    return message;
}

function handlePriceIntent(session, data, product) {
    logger.info("Extracted INTENT: CHECK_PRICE");
    logger.info("Extracted INTENT data: " + JSON.stringify(data));
    sessionManager.setProductInfo(session, {
        id: product.id,
        categoryid: product.CategoryId
    });

    if (Object.keys(product).length) {
        async.series([
            function(callback) {
                var price = (product.price > product.discount) ? product.discount : product.price;
                var delta = (product.price - product.discount) / 1000;
                var saleoffmsg = product.price > product.discount ? " (Có KM " + parseInt(delta) + "K VNĐ)" : " (Không KM)";
                var message = product.title;
                fbMessenger.sendTextMessage(data.fbid, message, function() {
                    message = "";
                    if (data.type.length > 0) {
                        var productTitle = product.title.latinise().toLowerCase();
                        for (var i = 0, length = data.type.length; i < length; i++) {
                            var index = data.type[i].indexOf('combo');
                            var index2 = data.type[i].indexOf('cb');
                            if ((index >= 0) || (index2 >= 0)) {
                                message = extractComboPrice(productTitle, saleoffmsg);
                            } else if (productTitle.indexOf(data.type[i]) < 0) {
                                message += "- Sản phẩm này không có kiểu " + data.type[i] + " bạn đang tìm.";
                            } else {
                                price = common.extractValue(productTitle, data.type[i] + " \\d+");
                                message += "- " + price.toUpperCase() + " K VNĐ" + saleoffmsg + "\n";
                            }
                        }
                    } else {
                        message = "- " + data.quantity[0] + " đôi " + " giá " + common.toCurrencyString(price * data.quantity[0], " VNĐ") + saleoffmsg;;
                    }
                    fbMessenger.sendTextMessage(data.fbid, message);
                    callback(null);
                });

            },
            function() {

            }
        ]);
    } else {
        showSimilarProductSuggestion(session);
    }
}

function handleAvailabilityIntent(session, data, product) {
    gProductFinder.getColorsNSizeNPhotos(product.id,
        function(colors, sizes, photos) {
            if (colors.length * sizes.length === 0) {
                fbMessenger.sendTextMessage(session.fbid,
                    "Sản phẩm hiện tạm thời hết hàng\n",
                    function() {
                        showSimilarProductSuggestion(session);
                    });
            } else {
                showAvailableColorNsize(session, true, true, true);
            }
        });
}

function handleAvailabilityColorIntent(session, data) {
    logger.info("Extracted INTENT: CHECK_AVAILABILITY");
    logger.info("Extracted INTENT data: " + JSON.stringify(data));

    if (data.color.length > 0) {
        gProductFinder.getProductColors(session.last_product.id, function(colors) {
            if (colors.length > 0) {
                var availableColors = getAvailableColorMsg(true, colors, data.color);
                fbMessenger.sendTextMessage(session.fbid, availableColors, function() {});
            } else {
                // Only show similar but not show product have same color`
                findProductByKeywords(session, data.msg);
            }
        });
    } else {
        callback(null, null);
    }
}

function handleAvailabilitySizeIntent(session, data) {
    logger.info("Extracted INTENT: CHECK_AVAILABILITY");
    logger.info("Extracted INTENT data: " + JSON.stringify(data));

    if (data.size != null && data.size.length > 0) {
        gProductFinder.getProductSizes(session.last_product.id, function(sizes) {
            var availableSizes = "";
            if (data.size.indexOf("all") >= 0) {
                // Only show similar but not show product have same color`
                availableSizes = getAvailableSizeMsg(true, sizes, JSON.stringify(sizes));
            } else {
                availableSizes = getAvailableSizeMsg(true, sizes, data.size);
            }
            fbMessenger.sendTextMessage(session.fbid, availableSizes);
        });
        //callback(null, colors, sizes);
    } else {
        findProductByKeywords(session, data.msg);
    }
}

function setUpUserIntentListener() {
    emitter.on(common.INTENT_CHECK_PRICE, function(data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        findLastSelectProduct(session, data, function(product) {
            if (product != null) {
                handlePriceIntent(session, data, product);
            } else {
                showSimilarProductSuggestion(session);
            }
        });
    });

    emitter.on(common.INTENT_CHECK_AVAILABILITY, function(data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        findLastSelectProduct(session, data, function(product) {
            if (product != null) {
                sessionManager.setProductInfo(session, {
                    id: product.id,
                    title: product.title
                });
                sessionManager.setCategoryId(session, product.CategoryId);

                if (data.size.length * data.color.length > 0) {
                    handleAvailabilityIntent(session, data, product);
                } else if (data.size.length) {
                    handleAvailabilitySizeIntent(session, data);
                } else if (data.color.length > 0) {
                    handleAvailabilityColorIntent(session, data);
                } else {
                    findProductByKeywords(session, data.msg);
                }
            } else {
                showSimilarProductSuggestion(session);
            }
        });
    });

    emitter.on(common.INTENT_CHECK_SHIP, function(data) {});

    emitter.on(common.INTENT_GENERAL_SEARCH, function(data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        processTextEvent(session, data.msg);
    });
}

//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//

module.exports = {
    enable_ai: function(use_ai) {
        gAiUsingFlag = use_ai;
    },
    start: function(homepage, storeConfig) {
        gStoreConfig = storeConfig;

        gHomepage = common.insertHttpPrefix(homepage);

        initWebHook();

        if (gAiUsingFlag) {
            intentParser = parserFactory.createParser(ParserFactory.CONSTANT.AI_PARSER);
        } else {
            intentParser = parserFactory.createParser(ParserFactory.CONSTANT.REGEXP_PARSER);
        }
        setUpUserIntentListener();
        intentParser.setEmitter(emitter);

        gProductFinder.findStoreByLink(gHomepage, function(store) {
            storeId = store.id;
        });
    }
}
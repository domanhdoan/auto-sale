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

var gStoreConfig = {};
var gPagesInfo = [];

var gAiUsingFlag = false;

var async = require("async");

// Keyword - results
var searchMap = {};

var storeId = -1;

function createAndSendOrderToFB(session, callback) {
    var orderInfo = sessionManager.getOrderInfo(session);
    gProductFinder.getOrderItems(orderInfo.id, function (items) {
        if (items.length > 0) {
            var sub_total = 0;
            var invoice_items = [];
            var length = items[0].Invoice.dataValues.creation_date.length;
            var delta = length - 10;
            if (delta > 0) {
                session.last_invoice.creation_date = items[0].Invoice.dataValues
                    .creation_date.slice(0, -1 * delta);
            }
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var title = item.Product.dataValues.title;
                var subtitle = "";
                var type = (common.isDefined(item.dataValues.type)) ? item.dataValues.type : "";
                var prices = common.extractProductPrices(title);
                logger.info("Type = " + type + " price = " + prices[type]);
                var price = (prices.length === 0) ? item.Product.dataValues.price : parseInt(prices[type]);
                if (type != "") {
                    subtitle += " Kiểu " + common.getProductTypeVN(type) + ", ";
                }
                subtitle += "Màu " + common.get_color_vn(item.Color.dataValues.name) 
                + ", Size " + item.Size.dataValues.value;
                var quantity = item.dataValues.quantity;
                var thumbnail_url = item.Product.dataValues.thumbnail;
``
                var jsonitem = fbMessenger.createOrderItemElement(
                    title, subtitle, price, quantity, thumbnail_url);
                invoice_items.push(jsonitem);
                sub_total += (price * quantity);
            }

            var invoice_summary = fbMessenger.generate_invoice_summary(sub_total / 100, 200);
            var invoice_adjustments = {};
            fbMessenger.sendReceiptMessage(session.fbid, session.token, invoice_items,
                orderInfo, invoice_summary, invoice_adjustments, callback);
        } else {
            logger.error("Can not find any order item");
        }
    });
}

function createAndSendOrderToStore(session, callback) {
    gProductFinder.getOrderItems(session.last_invoice.id, function (items) {
        for (var i = 0; i < items.length; i++) {
            var order = gStoreConfig.order_form;
            request({
                url: gHomepage,
                method: 'POST',
            }, function (error, response, body) {
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
            function (callback) {
                // fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn xem danh mục sản phẩm bên dưới nhé");
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
                fbMessenger.sendCategoriesElements(session.fbid, session.token, foundCategories);
                if (foundCategories.length == 1) {
                    SessionManager(session, foundCategories[0].id);
                }
            }
        ]);
    } else { }
}

function sendProductSearchResultsToFB(session, products) {
    var keys = Object.keys(products);
    if (keys.length > 0) {
        async.series([
            function (callback) {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_product_found, function () {
                    callback(null);
                });
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
                if (found_products.length == 1) {
                    sessionManager.setProductInfo(session, {
                        id: found_products[0].id,
                        title: found_products[0].title
                    });
                    sessionManager.setCategoryId(session, found_products[0].CategoryId);
                    showAvailableColorNsize(session, true, true, true);
                } else {
                    fbMessenger.sendProductElements(session.fbid, session.token, found_products);
                }
            }
        ]);
    } else {
        showSimilarProductSuggestion(session);
    }
}

function searchAndConfirmAddress(session, destination, callback) {
    // Handle a text message from this sender
    //getUserProfile(sender, function () {
    common.searchAddress(destination, function (result) {
        if (result.length > 0) {
            var length = 1; //result.length;
            for (var i = 0; i < length; i++) {
                logger.info("Full address: " + result[i].formattedAddress);
                fbMessenger.sendAddressConfirmMessage(session.fbid, session.token, result[i].formattedAddress);
                callback(result[i].formattedAddress);
            }
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token, "Không tìm thấy địa chỉ giao hàng\nBạn gủi lại địa chỉ nhé.");
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
        availableColorMessage = "\n- Màu sắc: ";
        var matchColorStr = "";
        var availableColors = "";
        if (colors != null && colors.length > 0) {
            for (var i = 0; i < colors.length; i++) {
                if (referColorsString.indexOf(colors[i].name) >= 0) {
                    matchColorStr += common.get_color_vn(colors[i].name) + ", ";
                } else { }
                availableColors += common.get_color_vn(colors[i].name) + ", ";
            }
            if (matchColorStr === "") {
                availableColorMessage = "Màu sắc bạn tìm hiện không còn.";
                availableColorMessage += " Bạn vui lòng xem màu còn hàng bên dưới: \n";
                availableColorMessage += " - " + availableColors.slice(0, -2);

            } else {
                availableColorMessage += matchColorStr.slice(0, -2) + " còn hàng";
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
                } else { }
                availableSizes += sizes[i].value + ", ";
            }
            if (matchSizes === "") {
                availableSizesMesage = "Size bạn tìm hiện tại không còn.";
                availableSizesMesage += "Bạn vui lòng xem size còn hàng bên dưới: \n";
                availableSizesMesage += "- " + availableSizes.slice(0, -2);
            } else {
                availableSizesMesage += matchSizes.slice(0, -2) + " còn hàng";
            }
        } else {
            availableSizesMesage += common.status_updating;
        }
    }
    return availableSizesMesage;
}

function showAvailableColorNsize(session, showColorFlag, showSizeFlag, showPhotoFlag) {
    var productInfo = sessionManager.getProductInfo(session);
    gProductFinder.getColorsNSizeNPhotos(productInfo.id,
        function (colors, sizes, photos) {
            var availableColorsMsg = getAvailableColorMsg(showColorFlag, colors, JSON.stringify(colors));
            var availableSizesMsg = getAvailableSizeMsg(showSizeFlag, sizes, JSON.stringify(sizes));
            logger.info("Product id = " + productInfo.id + " Details - \n" + availableColorsMsg + availableSizesMsg);
            if (showPhotoFlag && photos.length > 0) {
                fbMessenger.sendProductPhotoElements(session.fbid, session.token, productInfo.id,
                    productInfo.title, availableColorsMsg + availableSizesMsg, photos);
            } else {
                fbMessenger.sendTextMessage(session.fbid, session.token,
                    productInfo.title + availableColorsMsg + availableSizesMsg);
            }
        });
}

// =================================================================
// Methods for search product
// =================================================================
function showSimilarProductSuggestion(session) {
    // send suggestion for products in same category
    async.series([
        function (callback) {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_product_notfound, function () {
                callback(null);
            });
        },
        function (callback) {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_product_similar, function () {
                callback(null);
            });
        },
        function (callback) {
            var categoryInfo = sessionManager.getCategoryInfo(session);
            if (categoryInfo.id >= 0) {
                findProductByCategory(session);
            } else {
                findCategories(session);
            }
        }
    ]);
}

function findProductByThumbLink(session, thumbLink) {
    gProductFinder.findProductByThumbnail(session.storeUrl, thumbLink, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function findProductByDetailLink(session, link) {
    gProductFinder.findProductByLink(session.storeid, link, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function findProductByKeywords(session, keywords) {
    gProductFinder.findShoesByKeywords(session.storeid, keywords, function (products) {
        sendProductSearchResultsToFB(session, products);
    });
}

function findProductByCode(session, productCode) {
    gProductFinder.findProductByCode(session.storeid, productCode, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function findProductByCategory(session) {
    var categoryInfo = sessionManager.getCategoryInfo(session);
    gProductFinder.findProductsByCategory(session.storeid,
        categoryInfo.id,
        function (products) {
            sendProductSearchResultsToFB(session, products);
            if (Object.keys(products).length > 0) {
                sessionManager.setCategoryId(session, products[0].CategoryId);
            }
        });
}

function findCategories(session) {
    gProductFinder.findCategoriesByStoreId(session.storeid, function (categories) {
        sendCategorySearchResultsToFB(session, categories);
    });
}

function searchProducts(session, user_msg, user_msg_trans) {
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

function selectProductColor(session, user_message) {
    var orderInfo = sessionManager.getOrderInfo(session);
    var productInfo = sessionManager.getProductInfo(session);
    if (orderInfo.id == -1) {
        gModelFactory.createInitialInvoice(session.fbid,
            function (invoice) {
                sessionManager.setOrderInfo(session, {
                    id: invoice.id
                });
            });
    } else { }

    // Remove mua word to get color value
    var color_keyword = user_message.replaceAll(common.SEARCH_KEY_COLOR, "")
        .replaceAll(" ", "").trim();
    gProductFinder.checkProductByColor(productInfo.id,
        color_keyword,
        function (color) {
            if (color != null) {
                sessionManager.setUserAction(session, common.select_product_color);
                sessionManager.setProductInfo(session, {
                    color: color.id
                });
                var type = sessionManager.getProductInfo(session).type;
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_size, function () {
                    if (type === common.PRODUCT_TYPE_COMBO) {
                        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_size_combo);
                    }
                    showAvailableColorNsize(session, false, true, false);
                });
            } else {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_color_notfound,
                    function () {
                        showAvailableColorNsize(session, true, false, false);
                    });
            }
        });
}

function selectProductSize(session, user_message) {
    var productInfo = sessionManager.getProductInfo(session);
    var size = common.extractValue(user_message, "\\d+$");
    gProductFinder.checkProductBySize(productInfo.id,
        size, function (size) {
            if (Object.keys(size).length > 0) {
                sessionManager.setUserAction(session, common.select_product_size);
                sessionManager.setProductInfo(session, {
                    size: size.id
                });
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_quantity);
            } else {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_size_notfound,
                    function () {
                        showAvailableColorNsize(session, false, true, false);
                    });
            }
        });
}

function selectProductQuantity(session, user_message) {
    var productInfo = sessionManager.getProductInfo(session);
    var orderInfo = sessionManager.getOrderInfo(session);
    var lastAction = sessionManager.getLastAction(session);
    logger.debug("Order Quantity: " + user_message);
    var quantity = common.extractValue(user_message, "\\d+");
    if(productInfo.type === common.PRODUCT_TYPE_COMBO){

    }else{
        gModelFactory.createFashionOrderItem(productInfo.type,
            quantity,
            orderInfo.id,
            productInfo.id,
            productInfo.color,
            productInfo.size,
            function (saved_item) {
                logger.info("saved_item: " + saved_item);
                sessionManager.setUserAction(session, common.action_continue_search);
                fbMessenger.sendPurchaseConfirmMessage(session.fbid, session.token, "Bạn muốn tiếp tục chọn sản phẩm hay đặt hàng ngay?");
            });
    }    
}

function putProductToCart(session, text) {
    var user_req_trans = text.latinise().toLowerCase();
    var productInfo = sessionManager.getProductInfo(session);
    var orderInfo = sessionManager.getOrderInfo(session);
    var lastAction = sessionManager.getLastAction(session);
    if (session.last_action == common.select_type) {
        // Extract product type
        selectProductColor(session, user_req_trans);
    } else if (session.last_action == common.select_product_color) {
        selectProductSize(session, text);
    } else if (session.last_action == common.select_product_size) {
        selectProductQuantity(session, text);
    }
}

function makeProductOrder(session, text) {
    logger.info("Filling order information: " + text + "Start");
    if (session.last_action == common.set_quantity) {
        logger.debug("Name: " + text);
        sessionManager.setUserAction(session, common.set_recipient_name);
        sessionManager.setOrderInfo(session, {
            name: text
        });
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_phone);
    } else if (session.last_action == common.set_recipient_name) {
        logger.debug("Phone: " + text);
        sessionManager.setUserAction(session, common.set_phone);
        sessionManager.setOrderInfo(session, {
            phone: text
        });
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_address);
    } else if (session.last_action == common.set_phone) {
        logger.debug("Address: " + text);
        searchAndConfirmAddress(session, text, function (result) {
            sessionManager.setOrderInfo(session, {
                address: result
            });
        });
    } else if (session.last_action == common.set_address) {
        logger.debug("Email: " + text);
        var is_valid_email = validator.validate(text);
        if (is_valid_email) {
            sessionManager.setUserAction(session, common.set_email);
            sessionManager.setOrderInfo(session, {
                email: text
            });
            //fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_delivery_date);
            createAndSendOrderToFB(session, function () {
                fbMessenger.sendOrderConfirmMessage(session.fbid, session.token, "Xác nhận đơn hàng!");
            });
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_email);
        }
    // } else if (session.last_action == common.set_email) {
        //     logger.debug("Delivery: " + text);
        //     sessionManager.setUserAction(session, common.set_delivery_date);
        //     sessionManager.setOrderInfo(session, {
        //         delivery: text
        //     });
        // } else if (session.last_action == common.set_delivery_date) {
        // createAndSendOrderToFB(session, function () {
        //     fbMessenger.sendOrderConfirmMessage(session.fbid, session.token, "Xác nhận đơn hàng!");
        // });
    } else {
        logger.info("Unknow action = " + text);
    }
    logger.info("Filling order information: " + text + " for " + session.last_action + " END ");
    logger.info("Order ID " + sessionManager.getOrderInfo(session).id + " - Filling order information: " + text + " for " + session.last_action + " END ");
}

function cancelOrder(session) {
    var invoice_id = session.last_invoice.id;
    var status = "cancel";
    var orderInfo = sessionManager.getOrderInfo(session);

    gModelFactory.cancelInvoice(orderInfo.id, status,
        function (invoice) {
            sessionManager.resetSession(session);
        });
    sessionManager.setUserAction(session, common.say_greetings);
    fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
}

//=====================================================================//
//================= Process FB Message=================================//
//=====================================================================//

function processTextEvent(session, user_msg) {
    logger.info("processTextEvent: " + user_msg);
    var user_req_trans = user_msg.latinise().toLowerCase();
    var last_action_key = session.last_action;
    var last_action = common.sale_steps.get(last_action_key);
    var selectProductAction = common.sale_steps.get(common.select_product);
    var selectQuantityAction = common.sale_steps.get(common.set_quantity);
    var selectDeliveryDateAction = common.sale_steps.get(common.set_delivery_date);

    if (user_req_trans === common.action_terminate_order) {
        cancelOrder(session);
    } else if (last_action_key === common.say_greetings) {
        searchProducts(session, user_msg, user_req_trans);
    } else if ((last_action >= selectProductAction) && last_action < selectQuantityAction) {
        putProductToCart(session, user_msg);
    } else if ((last_action >= selectQuantityAction) && last_action <= selectDeliveryDateAction) {
        makeProductOrder(session, user_msg);
    } else {
        logger.error("Unknow message: " + user_msg);
    }
}

function processPostbackEvent(session, action_details) {
    var user_action = action_details.action;
    var productInfo = sessionManager.getProductInfo(session);
    var orderInfo = sessionManager.getOrderInfo(session);

    logger.info("processPostbackEvent: " + JSON.stringify(action_details));

    if (user_action === common.action_view_details) {
        sessionManager.setProductIdNTitle(session,
            action_details.id, action_details.title);
        showAvailableColorNsize(session, true, true, true);
    } else if (user_action === common.action_view_category) {
        sessionManager.setCategoryId(session, action_details.id);
        findProductByCategory(session);
    } else if (user_action === common.action_order) {
        sessionManager.setOrdeTrigerStatusInfo(session, true);
        sessionManager.setProductIdNTitle(session,
            action_details.id, action_details.title);
        var types = common.getAvailableProductType(productInfo.title);
        if (types.length <= 1 /*Only one type or not determined*/) {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_color,
                function () {
                    showAvailableColorNsize(session, true, false, false);
                });
            sessionManager.setUserAction(session, common.select_type);
        } else {
            var typeLabel = {
                nam:'Giầy Nam',
                nu:'Giầy Nữ',
                combo:"Combo (Nam + Nữ)"
            };
            fbMessenger.sendProductTypeConfirm(session.fbid, session.token, "Bạn vui lòng chọn kiểu sản phẩm:",
                typeLabel);
        }
    } else if (user_action === common.action_confirm_type) {
        sessionManager.setUserAction(session, common.select_type);
        sessionManager.setProductInfo(session, {
            type: action_details.type
        });
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_color,
            function () {
                var type = sessionManager.getProductInfo(session).type;
                if (type === common.PRODUCT_TYPE_COMBO) {
                    fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_color_combo);
                }
                showAvailableColorNsize(session, true, false, false);
            });
    } else if (user_action === common.action_continue_search) {
        if (!orderInfo.isOrdering) {
            sessionManager.setUserAction(session, common.say_greetings);
            sessionManager.setOrdeTrigerStatusInfo(session, false);            
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
        } else {
            logger.info("Not support this action when making order");
        }
    } else if (user_action === common.action_purchase) {
        sessionManager.setUserAction(session, common.set_quantity);
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_name);

    } else if (user_action === common.action_confirm_addr) {
        sessionManager.setUserAction(session, common.set_address);
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_email);

    } else if (user_action === common.action_retype_addr) {
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_address);

    } else if (user_action === common.action_confirm_order) {
        sessionManager.setOrderStatusInfo(session, "confirm");
        gModelFactory.updateInvoice(session.last_invoice, function (invoice) {
            logger.info(invoice);
            fbMessenger.sendTextMessage(session.fbid, session.token, common.say_thank_buying, function () {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
            });
            sessionManager.resetSession(session);
        });

    } else if (user_action === common.action_cancel_order) {
        gModelFactory.cancelInvoice(session.last_invoice.id, "cancel", function (invoice) {
            if (invoice != null) {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
                sessionManager.resetSession(session.fbid);
            }
        });
    } else {
        logger.error("Unknow action: " + JSON.stringify(action_details));
    }
}

function processEvent(event) {
    var sender = event.sender.id.toString();
    var receiver = event.recipient.id.toString();
    var pageInfo = gPagesInfo[receiver];
    if(pageInfo === null){
        return;
    }
    var currentSession = sessionManager.findOrCreateSession(pageInfo.StoreId, receiver, sender);
    currentSession.token = pageInfo.token;
    currentSession.storeUrl = pageInfo.Store.dataValues.home;

    var productInfo = sessionManager.getProductInfo(currentSession);
    if (event.message) {
        if (event.message.text) {
            var text = event.message.text;
            var isURL = common.isUrl(text);
            var isOrdering = sessionManager.isOrdeTrigerStatusInfo(currentSession);
            if (!isURL && !isOrdering) {
                var options = {
                    storeid: currentSession.storeid,
                    pageid: receiver,
                    fbid: sender,
                    productid: productInfo.id,
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
        if (delta > 100 /*avoid double click*/) {
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

    server.get(config.bots.fb_webhook, function (req, res) {
        if (req.query['hub.verify_token'] == FB_VERIFY_TOKEN) {
            res.send(req.query['hub.challenge']);
            console.log("call get");
            setTimeout(function () {
                fbMessenger.doSubscribeRequest();
            }, 3000);
        } else {
            res.send('Error, wrong validation token');
        }
    });

    server.post(config.bots.fb_webhook, function (req, res) {
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

    server.listen(config.bots.port, function () {
        console.log('FB BOT ready to go!');
    });
}

function findLastSelectProduct(session, data, callback) {
    if(common.isDefined(data.category) 
        && (data.category != "") && (data.code != data.category)){
        callback(null);
    }else if (common.isDefined(data.code) && data.code.length > 0) {
        gProductFinder.findProductByCode(session.storeid, data.code, function (product) {
            if (Object.keys(product).length > 0) {
                sessionManager.setProductIdNTitle(session, product.id, product.title);
            }
            callback(product);
        });
    } else if (data.productid >= 0) {
        gProductFinder.findProductById(data.productid, function (product) {
            callback(product);
        });
    } else {
        callback(null);
    }
}

function getProductPriceMessage(quantity, price, title, requestType, saleoffmsg) {
    var prices = common.extractProductPrices(title);
    if (prices[requestType] != "") {
        var price = parseInt(prices[requestType] / 1000) + "";
        message += "- " + price.toUpperCase() + " K VNĐ" + saleoffmsg + "\n";
    } else {
        message += "- Sản phẩm này không có kiểu " + typeVN[requestType] + " mà bạn đang tìm\n";
        message += "- " + quantity + " đôi " + " giá " + common.toCurrencyString(price * quantity, " VNĐ") + saleoffmsg;
    }
    return message;
}

function handlePriceIntent(session, data, product) {
    logger.info("Extracted INTENT CHECK_PRICE: " + JSON.stringify(data));
    sessionManager.setProductInfo(session, {
        id: product.id,
        title: product.title
    });
    sessionManager.setCategoryId(session, product.CategoryId);
    if (Object.keys(product).length) {
        async.series([
            function (callback) {
                var price = (product.price > product.discount) ? product.discount : product.price;
                var delta = (product.price - product.discount) / 1000;
                var saleoffmsg = product.price > product.discount ? " (Có KM " + parseInt(delta) + "K VNĐ)" : " (Không có KM)";
                var message = product.title;
                fbMessenger.sendTextMessage(data.fbid, message, function () {
                    message = "";
                    if (data.type.length > 0) {
                        var productTitle = product.title.latinise().toLowerCase();
                        for (var i = 0, length = data.type.length; i < length; i++) {
                            message = getProductPriceMessage(data.quantity[i], price, product.title, data.type[i], saleoffmsg);
                            fbMessenger.sendTextMessage(data.fbid, message);
                        }
                    } else {
                        message = "- " + data.quantity[0] + " đôi " + " giá " + common.toCurrencyString(price * data.quantity[0], " VNĐ") + saleoffmsg;;
                        fbMessenger.sendTextMessage(data.fbid, message);
                    }
                    var showPhotos = (data.productid != product.id) ? true : false;
                    fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn xem thêm thông tin về màu và size bên dưới nhé", function () {
                        showAvailableColorNsize(session, true, true, showPhotos);
                    });
                    callback(null);
                });

            },
            function () {

            }
        ]);
    } else {
        showSimilarProductSuggestion(session);
    }
}

function handleAvailabilityIntent(session, data, product) {
    var querydata = {
        category: data.category,
        colors: data.color.toString().replaceAll("[", "").replaceAll("]", "").replaceAll(" ", "").replaceAll(",", "','"),
        sizes: data.size.toString().replaceAll("[", "").replaceAll("]", "")
    };
    if (product != null) {
        querydata.category = (data.code === "") ? product.code : data.category;
    }
    gProductFinder.findShoesByKeywordsOpt(data.storeid, querydata, function (products) {
        if (products.length === 1) {
            var showPhotos = (data.productid != products[0].id) ? true : false;
            sessionManager.setProductInfo(session, {
                id: products[0].id,
                title: products[0].title
            });
            sessionManager.setCategoryId(session, products[0].CategoryId);
            if (data.size.length > 0) {
                fbMessenger.sendTextMessage(session.fbid, session.token, "Sản phẩm còn hàng. Bạn chọn màu bên dưới nhé", function () {
                    fbMessenger.sendTextMessage(session.fbid, session.token, "Shop sẽ check giúp bạn\n");
                    showAvailableColorNsize(session, true, false, showPhotos);
                });
            } else if (data.color.length > 0) {
                fbMessenger.sendTextMessage(session.fbid, session.token, "Sản phẩm còn hàng. Bạn chọn size bên dưới nhé\n", function () {
                    fbMessenger.sendTextMessage(session.fbid, session.token, "Shop sẽ check giúp bạn\n");
                    showAvailableColorNsize(session, false, true, showPhotos);                    
                });
            } else {
                fbMessenger.sendTextMessage(session.fbid, session.token, "Sản phẩm còn hàng. Bạn chọn màu và size bên dưới nhé", function () {
                    fbMessenger.sendTextMessage(session.fbid, session.token, "Shop sẽ check giúp bạn\n");
                    showAvailableColorNsize(session, true, true, showPhotos);
                });
            }
        } else if (products.length > 1) {
            sendProductSearchResultsToFB(session, products);
        } else {
            if (data.size.length > 0) {
                fbMessenger.sendTextMessage(session.fbid, session.token, "Shop hết size bạn chọn. Bạn chọn size khác bên dưới nhé", function () {
                    fbMessenger.sendTextMessage(session.fbid, session.token, "Shop sẽ check giúp bạn\n");
                    showAvailableColorNsize(session, false, true, true);
                });
            } else if (data.color.length > 0) {
                fbMessenger.sendTextMessage(session.fbid, session.token, "Shop hết màu bạn chọn. Bạn chọn màu khác bên dưới nhé", function () {
                    fbMessenger.sendTextMessage(session.fbid, session.token, "Shop sẽ check giúp bạn\n");
                    showAvailableColorNsize(session, true, false, true);
                });
            } else {
                showSimilarProductSuggestion(session);
            }
        }
    });
}

function setUpUserIntentListener() {
    emitter.on(common.INTENT_CHECK_PRICE, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        findLastSelectProduct(session, data, function (product) {
            if (product != null) {
                handlePriceIntent(session, data, product);
            } else {
                showSimilarProductSuggestion(session);
            }
        });
    });

    emitter.on(common.INTENT_CHECK_AVAILABILITY, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        findLastSelectProduct(session, data, function (product) {
            handleAvailabilityIntent(session, data, product);
        });
    });

    emitter.on(common.INTENT_CHECK_SHIP, function (data) {
        logger.info("Extracted INTENT CHECK_SHIP: " + JSON.stringify(data));
        if (data.intent == common.SHIP_FEE) {

        } else if (data.intent == common.SHIP_DURATION) {

        }
    });

    emitter.on(common.INTENT_GENERAL_SEARCH, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        processTextEvent(session, data.msg);
    });

    emitter.on(common.INTENT_UNKNOWN, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        //processTextEvent(session, data.msg);
        fbMessenger.sendTextMessage(session.fbid, session.token, "Shop không tìm thấy sản phẩm theo yêu cầu", function(){
           fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn vui lòng cung cấp thông tin thêm. Shop sẽ check giúp bạn");
           setTimeout(function () {
               fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn xem thêm danh mục sản phẩm bên dưới");
               findCategories(session);
           },100);
        });
    });
}

//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//

module.exports = {
    enable_ai: function (use_ai) {
        gAiUsingFlag = use_ai;
    },
    start: function (storeConfig) {
        gStoreConfig = storeConfig;

        initWebHook();

        if (gAiUsingFlag) {
            intentParser = parserFactory.createParser(ParserFactory.CONSTANT.AI_PARSER);
        } else {
            intentParser = parserFactory.createParser(ParserFactory.CONSTANT.REGEXP_PARSER);
        }

        setUpUserIntentListener();
        intentParser.setEmitter(emitter);

        // gProductFinder.findStoreByLink(gHomepage, function (store) {
        //     storeId = store.dataValues.id;
        //     logger.info("Store ID = "( + storeId);
        // });
        gProductFinder.getAllPages(function (pages) {
            pages.forEach(function (page) {
                gPagesInfo[page.pageId] = page;
            });
        });
    }

}

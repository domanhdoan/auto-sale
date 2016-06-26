'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var validator = require("email-validator");
var request = require('request');
var JSONbig = require('json-bigint');
var server = express();

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

// Keyword - results
var searchMap = {};

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

function sendSearchResultsToFB(session, products) {
    if (products == null) {
        // send suggestion for products in same category
        fbMessenger.sendTextMessage(session.fbid, common.notify_product_notfound);
    } else {
        fbMessenger.sendTextMessage(session.fbid, common.notify_product_search, function() {
            var found_products = null;
            var results = [];
            if (Array.isArray(products)) {
                found_products = products;
            } else {
                found_products = [];
                found_products.push(products);
            }
            var product_count = (found_products.length > common.product_search_max) ?
                common.product_search_max : found_products.length;
            for (var i = 0; i < product_count; i++) {
                var product_object = fbMessenger.createProductElement(
                    found_products[i].title,
                    found_products[i].price,
                    found_products[i].thumbnail.replaceAll("%%", "-"),
                    found_products[i].link.replaceAll("%%", "-"),
                    found_products[i].code,
                    found_products[i].id);
                results.push(product_object);
            }
            fbMessenger.sendGenericMessage(session.fbid, results);
            if (product_count == 1) {
                session.last_product.id = found_products[0].id;
            }
        });


    }
}

// =================================================================
// Methods for search product
// =================================================================

function findProductByImage(session, user_msg) {
    gProductFinder.findProductByThumbnail(gHomepage, user_msg, function(product) {
        sendSearchResultsToFB(session, product);
    });
}

function findProductByKeywords(session, message) {
    gProductFinder.findShoesByKeywords(message, function(products) {
        sendSearchResultsToFB(session, products);
    });
}

function findProductByCode(session, message) {
    gProductFinder.findProductsByCode(message, function(product) {
        sendSearchResultsToFB(session, product);
    });
}

function findProductByCategory(store_id) {}

function showAvailableColorNsize(session, show_color, show_size) {
    var productId = session.last_product.id;
    gProductFinder.getColorsNSize(productId,
        function(colors, sizes) {
            var available_colors = "";
            if (show_color) {
                available_colors = "\n - Màu sắc: ";
                if (colors != null && colors.length > 0) {
                    for (var i = 0; i < (colors.length - 1); i++) {
                        available_colors += common.get_color_vn(colors[i].name) + ", ";
                    }
                    available_colors += common.get_color_vn(colors[(colors.length - 1)].name);
                } else {
                    available_colors += common.updating;
                }
            }

            var available_sizes = "";
            if (show_size) {
                var available_sizes = "\n - Size: ";
                if (sizes != null && sizes.length > 0) {
                    for (var i = 0; i < (sizes.length - 1); i++) {
                        available_sizes += sizes[i].value + ", ";
                    }
                    available_sizes += sizes[(sizes.length - 1)].value;
                } else {
                    available_sizes += common.updating;
                }
            }
            logger.info("Product id = " + productId + "Details - " + available_colors + available_sizes);
            fbMessenger.sendTextMessage(session.fbid, session.last_product.title + available_colors + available_sizes);
        });
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
            var buttons = fbMessenger.createAddressConfirmElement();
            fbMessenger.sendConfirmMessage(session.fbid, result[i].formattedAddress, buttons);
            callback(result[i].formattedAddress);
        }
    });
    //});
}

function doProductSearch(session, user_msg, user_msg_trans) {
    var result = common.extractValue(user_msg, gStoreConfig.product_code_pattern);
    if (common.isUrl(user_msg)) {
        findProductByImage(session, user_msg);
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
                        showAvailableColorNsize(session, false, true);
                    });
                } else {
                    logger.debug("Product not found");
                    fbMessenger.sendTextMessage(session.fbid, common.notify_color_notfound,
                        function() {
                            showAvailableColorNsize(session, true, false);
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
                            showAvailableColorNsize(session, false, true);
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
        var confirm_buttons = fbMessenger.createSearchOrPurchaseElement();
        fbMessenger.sendConfirmMessage(session.fbid, "Bạn muốn tiếp tục chọn sản phẩm hay chốt đặt hàng?",
            confirm_buttons);
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
            var buttons = createConfirmOrCancelElement();
            fbMessenger.sendConfirmMessage(session.fbid, buttons);
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

    if (user_req_trans.indexOf(common.cmd_terminate_order) >= 0) {
        doCancelOrder(session);
    } else if (last_action_key == common.say_greetings) {
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
        session.last_product.id = action_details.id;
        session.last_product.title = action_details.title;
        showAvailableColorNsize(session, true, true);
    } else if (user_action.indexOf(common.action_order) >= 0) {
        session.last_product.id = action_details.id;
        session.last_action = common.select_product;
        session.last_product.title = action_details.title;
        session.last_invoice.is_ordering = true;
        fbMessenger.sendTextMessage(session.fbid, "     Bắt đầu đặt hàng\n" +
            common.pls_select_product_color,
            function() {
                showAvailableColorNsize(session, true, false);
            });
    } else if (session.last_invoice.is_ordering &&
        (user_action.indexOf(common.action_continue_search) >= 0)) {
        session.last_action = common.say_greetings;
        fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);
    } else if (user_action.indexOf(common.action_purchase) >= 0) {
        session.last_action = common.set_quantity;
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_name);
    } else if (user_action.indexOf(common.action_confirm_addr) >= 0) {
        session.last_action = common.set_address;
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_email);
    } else if (user_action.indexOf(common.action_retype_addr) >= 0) {
        fbMessenger.sendTextMessage(session.fbid, common.pls_enter_address);
    } else if (user_action.indexOf(common.action_confirm_order) >= 0) {
        session.last_invoice.status = "confirm";
        gModelFactory.update_invoice(session.last_invoice, function(invoice) {
            logger.info(invoice);
            sessionManager.resetSession(session.fbid);
            fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);
        });
    } else if (user_action.indexOf(common.action_cancel_order) >= 0) {
        gModelFactory.cancel_invoice(session.last_invoice.id, "cancel", function(invoice) {
            if (invoice != null) {
                user_sessions[session.sessionId] = initSession(session.fbid);
                fbMessenger.sendTextMessage(session.fbid, common.say_greetings);
            }
        });
    } else {
        logger.error("Unknow action: " + JSON.stringify(action_details));
    }
}

function processEvent(event) {
    var sender = event.sender.id.toString();
    var receiver = event.recipient.id.toString();
    var current_session = sessionManager.findOrCreateSession(sender);

    if (event.message) {
        if (event.message.text) {
            var text = event.message.text;

            var options = {
                fbid: sender,
                pageId: receiver,
                codePattern: gStoreConfig.product_code_pattern
            };
            intentParser.parse(text, options,
                function handle(info) {

                });
            processTextEvent(current_session, text);
        } else if (event.message.attachments != null) {
            var attachments = event.message.attachments;
            // handle the case when user send an image for searching product
            for (var i = 0; i < attachments.length; i++) {
                if (attachments[i].type === 'image') {
                    processTextEvent(current_session, attachments[i].payload.url);
                } else {
                    logger.info("Skipp to handle attachment");
                }
            }
        } else {

        }
    } else if (event.postback) {
        var postback = JSON.parse(event.postback.payload);
        var delta = event.timestamp - current_session.timestamp;
        if (delta > 150 /*avoid double click*/ ) {
            current_session.timestamp = event.timestamp;
            processPostbackEvent(current_session, postback);
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
    }
}
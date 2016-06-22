'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var validator = require("email-validator");
var request = require('request');
const apiai = require('apiai');
const uuid = require('node-uuid');
const JSONbig = require('json-bigint');
const async = require('async');

var config = require("../config/config.js");

var common = require("../util/common");
var logger = require("../util/logger.js");

var g_model_factory = require("../dal/model_factory.js");

// Refactory code
var SessionManager = require("../util/session_manager.js");
var sessionManager = new SessionManager();

var FBMessenger = require("../dal/fbmessenger.js");
var fbMessenger = new FBMessenger();

var g_store_id = "";
var g_home_page = "";
var g_search_path = "";
var g_product_finder = null;
var g_store_pattern = {};

var g_ai_using = false;
const APIAI_ACCESS_TOKEN = config.bots.ai_token;
const APIAI_LANG = config.bots.ai_lang;
const FB_VERIFY_TOKEN = config.bots.fb_verify_token;

// Keyword - results
var search_map = {};

function createAndSendOrderToFB(session, callback) {
    g_product_finder.getOrderItems(session.last_invoice.id, function (items) {
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
            var subtitle = "Mô tả SP: Màu " + common.get_color_vn(items[i].Color.dataValues.name)
                + " và size " + items[i].Size.dataValues.value;
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
    g_product_finder.getOrderItems(session.last_invoice.id, function (items) {
        for (var i = 0; i < items.length; i++) {
            var order = g_store_pattern.order_form;
            request({
                url: g_home_page,
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

function sendSearchResultsToFB(session, products) {
    if (products == null) {
        // send suggestion for products in same category
        fbMessenger.sendTextMessage(session.fbid, common.notify_product_notfound);
    } else {
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
                found_products[i].dataValues.title,
                found_products[i].dataValues.price,
                found_products[i].dataValues.thumbnail.replaceAll("%%", "-"),
                found_products[i].dataValues.link.replaceAll("%%", "-"),
                found_products[i].dataValues.code,
                found_products[i].dataValues.id);
            results.push(product_object);
        }
        fbMessenger.sendGenericMessage(session.fbid, results);
        if (product_count == 1) {
            session.last_product.id = found_products[0].dataValues.id;
        }
    }

}

// =================================================================
// Methods for search product
// =================================================================

function findProductByImage(session, user_msg) {
    g_product_finder.findProductByThumbnail(g_home_page, user_msg, function (product) {
        sendSearchResultsToFB(session, product);
    });
}

function findProductByKeywords(session, message) {
    g_product_finder.findShoesByKeywords(message, function (products) {
        var product_count = (products.length > common.product_search_max) ? common.product_search_max : products.length;
        if (products.length > 0) {
            // user_sessions[sessionId].last_action = common.find_product;
            var found_products1 = [];
            var found_products2 = [];
            var found_products = [];
            for (var i = 0; i < product_count; i++) {
                var product_object = fbMessenger.createProductElement(
                    products[i].title,
                    products[i].price,
                    products[i].thumbnail.replaceAll("%%", "-"),
                    products[i].link.replaceAll("%%", "-"),
                    products[i].code,
                    products[i].id);
                if (session.last_product.id <= products[i].id) {
                    found_products1.push(product_object);
                } else {
                    found_products2.push(product_object);
                }

            }
            found_products = found_products1.concat(found_products2);
            fbMessenger.sendGenericMessage(session.fbid, found_products);
            search_map[message] = found_products;
            session.last_search = message;
        } else {
            fbMessenger.sendTextMessage(session.fbid, common.notify_product_notfound);
        }
    });
}

function findProductByCode(session, message) {
    g_product_finder.findProductsByCode(message, function (product) {
        sendSearchResultsToFB(session, product);
    });
}

function findProductByCategory(store_id) {
}

function showAvailableColorNsize(session, show_color, show_size) {
    var productId = session.last_product.id;
    g_product_finder.getColorsNSize(productId,
        function (colors, sizes) {
            var available_colors = "";
            if (show_color) {
                available_colors = "\n - Màu sắc: ";
                if (colors != null && colors.length > 0) {
                    for (var i = 0; i < (colors.length - 1); i++) {
                        available_colors += common.get_color_vn(colors[i].dataValues.name) + ", ";
                    }
                    available_colors += common.get_color_vn(colors[(colors.length - 1)].dataValues.name);
                } else {
                    available_colors += common.updating;
                }
            }

            var available_sizes = "";
            if (show_size) {
                var available_sizes = "\n - Size: ";
                if (sizes != null && sizes.length > 0) {
                    for (var i = 0; i < (sizes.length - 1); i++) {
                        available_sizes += sizes[i].dataValues.value + ", ";
                    }
                    available_sizes += sizes[(sizes.length - 1)].dataValues.value;
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
    common.search_address(destination, function (result) {
        var length = 1;//result.length;
        for (var i = 0; i < length; i++) {
            logger.info("Full address: " + result[i].formattedAddress);
            //logger.info("City = " + result[i].city);
            //logger.info("Province / State = " + result[i].administrativeLevels.level1long);
            var buttons = createAddressConfirmElement();
            fbMessenger.sendConfirmMessage(session.fbid, result[i].formattedAddress, buttons);
            callback(result[i].formattedAddress);
        }
    });
    //});
}

function doProductSearch(session, user_msg, user_msg_trans) {
    var result = common.extract_product_code(user_msg,
        g_store_pattern.product_code_pattern);
    if (common.is_url(user_msg)) {
        findProductByImage(session, user_msg);
    } else if (result.is_code) {
        findProductByCode(session, result.code);
    } else {
        findProductByKeywords(session, user_msg_trans);
    }
}

function doProductOrder(session, text) {
    var user_req_trans = text.latinise().toLowerCase();
    if (session.last_action == common.select_product) {
        // Remove mua word to get color value
        var color_keyword = user_req_trans.replaceAll("mau", "").replaceAll(" ", "").trim();
        g_product_finder.checkProductByColor(session.last_product.id,
            color_keyword, function (color) {
                if (color != null) {
                    session.last_action = common.select_product_color;
                    session.last_product.color = color.dataValues.id;
                    fbMessenger.sendTextMessage(session.fbid, common.pls_select_product_size, function () {
                        showAvailableColorNsize(session, false, true);
                    });
                } else {
                    logger.debug("Product not found");
                    fbMessenger.sendTextMessage(session.fbid, common.notify_color_notfound,
                        function () {
                            showAvailableColorNsize(session, true, false);
                        });
                }
            });
    } else if (session.last_action == common.select_product_color) {
        g_product_finder.checkProductBySize(session.last_product.id,
            text, function (size) {
                if (size != null) {
                    session.last_action = common.select_product_size;
                    session.last_product.size = size.dataValues.id;
                    fbMessenger.sendTextMessage(session.fbid, common.pls_enter_quantity);
                } else {
                    fbMessenger.sendTextMessage(session.fbid, common.notify_size_notfound,
                        function () {
                            showAvailableColorNsize(session, false, true);
                        });
                }
            });
    } else if (session.last_action == common.select_product_size) {
        logger.debug("Order Quantity: " + text);
        g_model_factory.create_fashion_item(parseInt(text),
            session.last_invoice.id,
            session.last_product.id,
            session.last_product.color,
            session.last_product.size,
            function (saved_item) {
                logger.info("saved_item: " + saved_item);
            });

        session.last_action = common.say_search_continue_message;
        var confirm_buttons = createSearchOrPurchaseElement();
        fbMessenger.sendConfirmMessage(session.fbid, "Xác nhận đơn đặt hàng.",
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
        searchAndConfirmAddress(session, text, function (result) {
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
        createAndSendOrderToFB(session, function () {
            var buttons = createConfirmOrCancelElement();
            fbMessenger.sendConfirmMessage(session.fbid, buttons);
        });
    } else {
        logger.info("Unknow action = " + text);
    }
}

//=====================================================================//
//================= AI service ========================================//
//=====================================================================//

const apiAiService = apiai(APIAI_ACCESS_TOKEN, { language: APIAI_LANG, requestSource: "fb" });
const aiSessionIds = new Map();
function processTextByAI(text, sender) {
    if (!aiSessionIds.has(sender)) {
        aiSessionIds.set(sender, uuid.v1());
    }
    let apiaiRequest = apiAiService.textRequest(text,
        {
            sessionId: aiSessionIds.get(sender)
        });

    apiaiRequest.on('response', (response) => {
        if (isDefined(response.result)) {
            let responseText = response.result.fulfillment.speech;
            let responseData = response.result.fulfillment.data;
            let action = response.result.action;

            console.log("response fulfillment: ", response.result.fulfillment);
            console.log("response data: ", responseData);

            if (isDefined(responseData) && isDefined(responseData.facebook)) {
                try {
                    console.log('Response as formatted message');
                    //fbMessenger.sendTextMessage(sender, responseData.facebook);
                    sendDataToFBMessenger(sender, responseData.facebook)
                } catch (err) {
                    fbMessenger.sendTextMessage(sender, { text: err.message });
                }
            } else if (isDefined(responseText)) {
                console.log('Response as text message');
                // facebook API limit for text length is 320,
                // so we split message if needed
                var splittedText = splitResponse(responseText);
                async.eachSeries(splittedText, (textPart, callback) => {
                    fbMessenger.sendTextMessage(sender, textPart);
                });
            }
        }
    });

    apiaiRequest.on('error', (error) => console.error(error));
    apiaiRequest.end();
}
//=====================================================================//
//================= AI service ========================================//
//=====================================================================//
function processTextEvent(session, user_msg) {
    var user_req_trans = user_msg.latinise().toLowerCase();
    var last_action_key = session.last_action;
    var last_action = common.sale_steps.get(last_action_key);
    if (user_req_trans.indexOf(common.cmd_terminate_order) >= 0) {
        var invoice_id = session.last_invoice.id;
        var status = "cancel";
        session.last_invoice.is_ordering = false;
        g_model_factory.cancel_invoice(invoice_id, status,
            function (invoice) {
                session.last_invoice.id = -1;
                session.last_product.id = -1;
                session.last_invoice.id = -1;
                session.last_invoice.status = "cancel";
            });
        fbMessenger.sendTextMessage(session.fbid, common.pls_reset_buying);
        session.last_action = common.say_greetings;
        fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);
        /*Handle what user send to fanpage*/
    } else if (last_action_key == common.say_greetings) {
        if (session.last_invoice.id == -1) {
            g_model_factory.create_empty_invoice(session.fbid,
                function (invoice) {
                    session.last_invoice.id = invoice.id;
                });
        } else { }
        doProductSearch(session, user_msg, user_req_trans);
    } else if ((last_action >= common.sale_steps.get(common.select_product))
        && last_action < common.sale_steps.get(common.set_quantity)) {
        doProductOrder(session, user_msg);
    } else if ((last_action >= common.sale_steps.get(common.set_quantity))
        && last_action <= common.sale_steps.get(common.set_delivery_date)) {
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
        doProductSearch(session, session.last_search, session.last_search);
    } else if (user_action.indexOf(common.action_order) >= 0) {
        session.last_product.id = action_details.id;
        session.last_action = common.select_product;
        session.last_product.title = action_details.title;
        session.last_invoice.is_ordering = true;
        fbMessenger.sendTextMessage(session.fbid, "Bắt đầu đặt hàng. " +
            common.pls_select_product_color, function () {
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
        g_model_factory.update_invoice(session.last_invoice, function (invoice) {
            logger.info(invoice);
            sessionManager.resetSession(session.fbid);
            fbMessenger.sendTextMessage(session.fbid, common.pls_select_product);
        });
    } else if (user_action.indexOf(common.action_cancel_order) >= 0) {
        g_model_factory.cancel_invoice(session.last_invoice.id, "cancel", function (invoice) {
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
    var current_session = sessionManager.findOrCreateSession(sender);
    if (event.message) {
        if (event.message.text) {
            var text = event.message.text;

            if (g_ai_using) {
                processTextByAI(text, sender);
            } else {
                processTextEvent(current_session, text);
            }
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
        if (delta > 150 /*avoid double click*/) {
            current_session.timestamp = event.timestamp;
            processPostbackEvent(current_session, postback);
        } else {
            logger.info("Skipp to handle double click");
        }
    }
}

function splitResponse(str) {
    if (str.length <= 320) {
        return [str];
    }

    var result = chunkString(str, 300);

    return result;

}

function chunkString(s, len) {
    var curr = len, prev = 0;

    var output = [];

    while (s[curr]) {
        if (s[curr++] == ' ') {
            output.push(s.substring(prev, curr));
            prev = curr;
            curr += len;
        }
        else {
            var currReverse = curr;
            do {
                if (s.substring(currReverse - 1, currReverse) == ' ') {
                    output.push(s.substring(prev, currReverse));
                    prev = currReverse;
                    curr = currReverse + len;
                    break;
                }
                currReverse--;
            } while (currReverse > prev)
        }
    }
    output.push(s.substr(prev));
    return output;
}

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//
var server = express();
server.use(bodyParser.text({ type: 'application/json' }));

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
//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//

//=====================================================================//
//================= AI webhook ========================================//
//=====================================================================//
var ai_webhook = express();
ai_webhook.use(bodyParser.json());
ai_webhook.post(config.bots.ai_webhook, function (req, res) {
    // get the parameters
    var action = req.body.result.action
    action = req.body.result.action
    console.log("request action: ", action);
    var user_msg_trans = translator("giày nam mầu xanh lam size 36");
    g_product_finder.findShoesByKeywords(user_msg_trans, function (products) {
        var product_count = (products.length > common.product_search_max) ?
            common.product_search_max : products.length;
        if (products.length > 0) {
            var found_products = [];
            for (var i = 0; i < product_count; i++) {
                var product_object = fbMessenger.createProductElement(
                    products[i].title,
                    products[i].price,
                    products[i].thumbnail.replaceAll("%%", "-"),
                    products[i].link.replaceAll("%%", "-"),
                    products[i].code,
                    products[i].id);
                found_products.push(product_object);
            }
            var response = createAIAPIProductsMessage(found_products);
            logger.info(JSON.stringify(response));
            res.setHeader('content-type', 'application/json');
            res.send(response);
        } else {
            fbMessenger.sendTextMessage(session.fbid, common.notify_product_notfound);
        }
    });
});
//=====================================================================//
//================= AI webhook ========================================//
//=====================================================================//

module.exports = {
    enable_ai: function (use_ai) {
        g_ai_using = use_ai;
    },
    start: function (home_page, store_crawling_pattern,
        products_finder, model_factory) {
        g_product_finder = products_finder;
        g_home_page = home_page;
        g_store_pattern = store_crawling_pattern;

        //fbMessenger.doSubscribeRequest();
        server.use(bodyParser.urlencoded({ extended: true }));
        server.listen(config.bots.port, function () {
            console.log('FB BOT ready to go!');
        });

        if (g_ai_using) {
            ai_webhook.listen(config.bots.ai_port);
        }

        g_product_finder.findStoreByLink(home_page,
            function (store) {
                g_store_id = store.dataValues.id;
            });

        g_model_factory = model_factory;
    }
}
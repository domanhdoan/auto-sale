'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var validator = require("email-validator");
var request = require('request');
var translator = require('speakingurl').createSlug({ maintainCase: true, separator: " " });
const apiai = require('apiai');
const uuid = require('node-uuid');
const JSONbig = require('json-bigint');
const async = require('async');
var fbmsg_sender = require("../util/fbmsg_sender");
var common = require("../util/common");
var config = require("../config/config.js");
var logger = require("../util/logger.js");

var g_store_id = "";
var g_home_page = "";
var g_search_path = "";
var g_product_finder = null;
var g_model_factory = require("../models/model_factory.js");
var g_product_code_pattern = "";

var g_ai_using = false;

const APIAI_ACCESS_TOKEN = config.bots.ai_token;
const APIAI_LANG = config.bots.ai_lang;
const FB_VERIFY_TOKEN = config.bots.fb_verify_token;
const FB_PAGE_ACCESS_TOKEN = config.bots.fb_page_token;

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================

function createProductElement(title, price, thumbnail_url, link, code, id) {
    var payload1 = {};
    payload1.id = id;
    payload1.title = title;
    payload1.action = common.action_view_details;
    var payload2 = {};
    payload2.id = id;
    payload2.title = title;
    payload2.action = common.action_order;
    var element = {
        "title": title,
        "subtitle": price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " VNĐ",
        "image_url": thumbnail_url,
        "buttons": [
            {
                "type": "postback",
                "title": "Xem Chi tiết",
                "payload": JSON.stringify(payload1)
            },
            {
                "type": "postback",
                "title": "Đặt hàng",
                "payload": JSON.stringify(payload2),
            },
            {
                "type": "web_url",
                "url": link,
                "title": "Xem trên Web"
            }]
    };
    return element;
}

function createSearchOrPurchaseElement() {
    var purchase_action = {};
    var search_action = {};
    search_action.action = common.action_continue_search;
    purchase_action.action = common.action_purchase;
    var template = [{
        "type": "postback",
        "title": "Thêm sản phẩm",
        "payload": JSON.stringify(search_action),
    },
        {
            "type": "postback",
            "title": "Mua hàng",
            "payload": JSON.stringify(purchase_action),
        }];
    return template;
}

function createConfirmOrCancelElement() {
    var confirm_action = {};
    var cancel_action = {};
    confirm_action.action = common.action_confirm_order;
    cancel_action.action = common.action_cancel_order;
    var template = [
        {
            "type": "postback",
            "title": "Hủy mua hàng",
            "payload": JSON.stringify(cancel_action),
        },
        {
            "type": "postback",
            "title": "Xác nhận",
            "payload": JSON.stringify(confirm_action),
        }
    ];
    return template;
}

function createAIAPIProductsMessage(rich_data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    return {
        "speech": "Found products are",
        "displayText": "San pham tim thay",
        "data": {
            "facebook": messageData
        },
        "source": "joybox web service"
    }
}

function sendDataToFBMessenger(sender, data, callback) {
    logger.info("Data = " + JSON.stringify(data));
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: config.bots.fb_page_token },
        method: 'POST',
        json: true,
        body: {
            recipient: { id: sender },
            message: data
        }
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

function sendTextMessage(sender, simple_text, callback) {
    var messageData = {
        text: simple_text
    }
    console.log("Sender = " + sender);
    sendDataToFBMessenger(sender, messageData, callback);
}

function sendGenericMessage(sender, rich_data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    sendDataToFBMessenger(sender, messageData, null);
}

function sendConfirmMessage(sender, buttons) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": "Xác nhận đơn đặt hàng.",
                "buttons": buttons
            }
        }
    };
    sendDataToFBMessenger(sender, messageData, null);
}

function createOrderItemElement (title, desc, price, quantity, thumbnail_url) {
    var jsonItem = {
        "title": title,
        "subtitle": "",
        "quantity": quantity,
        "price": price,
        "currency": "VND",
        "image_url": thumbnail_url.replaceAll("%%", "-")
    };
    return jsonItem;
}

function generate_invoice_summary(sub_total, shipping_cost) {
    var summary = {
        "subtotal": sub_total,
        "shipping_cost": shipping_cost,
        "total_tax": sub_total * 0.05, // 5 % VAT
        "total_cost": (sub_total + shipping_cost + sub_total * 0.05)
    };

    return summary;
}

function generate_invoice_adjustment() {
    var adjustments = [
        {
            "name": "New Customer Discount",
            "amount": 20
        },
        {
            "name": "$10 Off Coupon",
            "amount": 10
        }
    ];

    return adjustments;
}

function sendReceiptMessage(sender, invoice_items, invoice_details, 
    summary, adjustments, callback) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "receipt",
                "order_number": invoice_details.id,
                "recipient_name": invoice_details.name,
                "elements": invoice_items,
                "currency": "VND",
                "order_url": "",
                "timestamp": invoice_details.creation,
                "address": {
                    "street_1": invoice_details.address,
                    "city": "Hà Nội",
                    "postal_code": "10000",
                    "state": "Hà Nội",
                    "country": "VN"
                },
                "payment_method": "COD",
                "summary": summary,
                "adjustments": adjustments
            }
        }
    }
    sendDataToFBMessenger(sender, messageData, callback);
}

function createAndSendInvoice(session, callback) {
    g_product_finder.getOrderItems(session.last_invoice.id, function (items) {
        var invoice_items = [];
        var sub_total = 0;
        for (var i = 0; i < items.length; i++) {
            var title = items[i].Product.dataValues.title;
            var price = items[i].Product.dataValues.price;
            var subtitle = items[i].Product.dataValues.desc;
            var quantity = items[i].dataValues.quantity;
            var thumbnail_url = items[i].Product.dataValues.thumbnail;
            var jsonitem = createOrderItemElement(title, subtitle, 
                price, quantity, thumbnail_url);

            invoice_items.push(jsonitem);
            sub_total += (price * quantity);
        }

        var invoice_details = session.last_invoice;
        var invoice_summary = generate_invoice_summary(sub_total/100, 200);
        var invoice_adjustments = {};
        sendReceiptMessage(session.fbid, invoice_items,
            invoice_details, invoice_summary, invoice_adjustments, callback);
    });
}

// =================================================================
// Methods for managing user sessions
// =================================================================
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
const user_sessions = {};

const getFirstMessagingEntry = (body) => {
    const val = body.object == 'page' &&
        body.entry &&
        Array.isArray(body.entry) &&
        body.entry.length > 0 &&
        body.entry[0] &&
        // body.entry[0].id === FB_PAGE_ID &&
        body.entry[0].messaging &&
        Array.isArray(body.entry[0].messaging) &&
        body.entry[0].messaging.length > 0 &&
        body.entry[0].messaging[0];
    return val || null;
};

const initSession = (fbid) => {
    return {
        fbid: fbid,
        context: {},
        last_product: {
            id: -1,
            title: "",
            color: -1,
            size: -1
        },
        last_action: common.say_greetings,
        timestamp: 0,
        last_invoice: {
            id: -1,
            name: "",
            phone: "",
            address: "",
            delivery: "",
            email: "",
            status: "",
            creation:"",
            is_ordering: false
        }
    };
}

const findOrCreateSession = (fbid) => {
    let sessionId;
    // Let's see if we already have a session for the user fbid
    Object.keys(user_sessions).forEach(k => {
        if (user_sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        user_sessions[sessionId] = initSession(fbid);
    }
    return sessionId;
};

function deteleSession(sessionId) {
    delete user_sessions[sessionId];
}
// =================================================================
// Methods for handling user request
// =================================================================

function find_products_by_image(session, user_msg) {
    g_product_finder.findProductByThumbnail(g_home_page, user_msg, function (product) {
        var found_products = [];
        var product_object = createProductElement(
            product.dataValues.title,
            product.dataValues.price,
            product.dataValues.thumbnail.replaceAll("%%", "-"),
            product.dataValues.link.replaceAll("%%", "-"),
            product.dataValues.code,
            product.dataValues.id);
        found_products.push(product_object);
        session.last_product.id = product.dataValues.id;
        sendGenericMessage(session.fbid, found_products);
    });
}

function find_products_by_keywords(session, message) {
    g_product_finder.findShoesByKeywords(message, function (products) {
        var product_count = (products.length > common.product_search_max) ? common.product_search_max : products.length;
        if (products.length > 0) {
            // user_sessions[sessionId].last_action = common.find_product;
            var found_products = [];
            for (var i = 0; i < product_count; i++) {
                var product_object = createProductElement(
                    products[i].title,
                    products[i].price,
                    products[i].thumbnail.replaceAll("%%", "-"),
                    products[i].link.replaceAll("%%", "-"),
                    products[i].code,
                    products[i].id);
                found_products.push(product_object);
            }
            sendGenericMessage(session.fbid, found_products);
        } else {
            sendTextMessage(session.fbid, common.notify_product_notfound);
        }
    });
}

function find_products_by_code(session, message) {
    g_product_finder.findProductsByCode(message, function (product) {
        if (product != null) {
            // current_session.last_action = common.find_product;
            session.last_product.id = product.dataValues.id;
            var found_products = [];
            var product_object = createProductElement(
                product.dataValues.title,
                product.dataValues.price,
                product.dataValues.thumbnail.replaceAll("%%", "-"),
                product.dataValues.link.replaceAll("%%", "-"),
                product.dataValues.code,
                product.dataValues.id);
            found_products.push(product_object);
            sendGenericMessage(session.fbid, found_products);
            //sendTextMessage(session.fbid, common.pls_select_product_color);
        } else {
            logger.debug("Product not found");
            sendTextMessage(session.fbid, common.notify_product_notfound);
        }
    });
}

function find_categories(store_id) {
    g_product_finder.findCategoriesByStoreId(store_id, function (categories) {
        for (var i = 0; i < categories.length; i++) {
            console.log(categories[i].dataValues.name.trim());
        }
    });
}

function show_available_colorNsize(session, show_color, show_size) {
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
            sendTextMessage(session.fbid, session.last_product.title + available_colors + available_sizes);
        });
}

function execute_search_product(session, user_msg, user_msg_trans) {
    var result = common.extract_product_code(user_msg, g_product_code_pattern);
    if (common.is_url(user_msg)) {
        find_products_by_image(session, user_msg);
    } else if (result.is_code) {
        find_products_by_code(session, result.code);
    } else {
        find_products_by_keywords(session, user_msg_trans);
    }
}

function execute_order_product(session, text) {
    var user_req_trans = translator(text).toLowerCase();
    if (session.last_action == common.select_product) {
        // Remove mua word to get color value
        var color_keyword = user_req_trans.replaceAll("mau", "").replaceAll(" ", "").trim();
        g_product_finder.checkProductByColor(session.last_product.id,
            color_keyword, function (color) {
                if (color != null) {
                    session.last_action = common.select_product_color;
                    session.last_product.color = color.dataValues.id;
                    sendTextMessage(session.fbid, common.pls_select_product_size, function () {
                        show_available_colorNsize(session, false, true);
                    });
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(session.fbid, common.notify_color_notfound,
                        function () {
                            show_available_colorNsize(session, true, false);
                        });
                }
            });
    } else if (session.last_action == common.select_product_color) {
        g_product_finder.checkProductBySize(session.last_product.id,
            text, function (size) {
                if (size != null) {
                    session.last_action = common.select_product_size;
                    session.last_product.size = size.dataValues.id;
                    sendTextMessage(session.fbid, common.pls_enter_quantity);
                } else {
                    sendTextMessage(session.fbid, common.notify_size_notfound,
                        function () {
                            show_available_colorNsize(session, false, true);
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
        sendConfirmMessage(session.fbid, confirm_buttons);
    }
}

function execute_finish_invoice(session, text) {
    if (session.last_action == common.set_quantity) {
        logger.debug("Name: " + text);
        session.last_action = common.set_recipient_name;
        sendTextMessage(session.fbid, common.pls_enter_phone);
        session.last_invoice.name = text;
    } else if (session.last_action == common.set_recipient_name) {
        logger.debug("Phone: " + text);
        session.last_action = common.set_phone;
        sendTextMessage(session.fbid, common.pls_enter_address);
        session.last_invoice.phone = text;
    } else if (session.last_action == common.set_phone) {
        logger.debug("Address: " + text);
        session.last_action = common.set_address;
        sendTextMessage(session.fbid, common.pls_enter_email);
        session.last_invoice.address = text;
    } else if (session.last_action == common.set_address) {
        logger.debug("Email: " + text);
        var is_valid_email = validator.validate(text);
        if (is_valid_email) {
            session.last_invoice.email = text;
            session.last_action = common.set_delivery_date;
            sendTextMessage(session.fbid, common.pls_enter_delivery_date);
        } else {
            sendTextMessage(session.fbid, common.pls_enter_email);
        }
    } else if (session.last_action == common.set_email) {
        logger.debug("Delivery: " + text);
        session.last_invoice.delivery = text;
        session.last_action = common.set_delivery_date;
    } else if (session.last_action == common.set_delivery_date) {
        createAndSendInvoice(session, function(){
            var buttons = createConfirmOrCancelElement();
            sendConfirmMessage(session.fbid, buttons);
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
                    //sendTextMessage(sender, responseData.facebook);
                    sendDataToFBMessenger(sender, responseData.facebook)
                } catch (err) {
                    sendTextMessage(sender, { text: err.message });
                }
            } else if (isDefined(responseText)) {
                console.log('Response as text message');
                // facebook API limit for text length is 320,
                // so we split message if needed
                var splittedText = splitResponse(responseText);
                async.eachSeries(splittedText, (textPart, callback) => {
                    sendTextMessage(sender, textPart);
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
    var user_req_trans = translator(user_msg).toLowerCase();
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
        sendTextMessage(session.fbid, common.pls_reset_buying);
        session.last_action = common.say_greetings;
        sendTextMessage(session.fbid, common.pls_select_product);
        /*Handle what user send to fanpage*/
    } else if (last_action_key == common.say_greetings) {
        if (session.last_invoice.id == -1) {
            g_model_factory.create_empty_invoice(session.fbid,
                function (invoice) {
                    session.last_invoice.id = invoice.id;
                });
        } else { }
        execute_search_product(session, user_msg, user_req_trans);
    } else if ((last_action >= common.sale_steps.get(common.select_product))
        && last_action < common.sale_steps.get(common.set_quantity)) {
        execute_order_product(session, user_msg);
    } else if ((last_action >= common.sale_steps.get(common.set_quantity))
        && last_action <= common.sale_steps.get(common.set_delivery_date)) {
        execute_finish_invoice(session, user_msg);
    } else {
        logger.error("Unknow message: " + user_msg);
    }
}

function processPostbackEvent(session, action_details) {
    var user_action = action_details.action;
    if (user_action.indexOf(common.action_view_details) >= 0) {
        session.last_product.id = action_details.id;
        session.last_product.title = action_details.title;
        show_available_colorNsize(session, true, true);
    } else if (user_action.indexOf(common.action_order) >= 0) {
        session.last_product.id = action_details.id;
        session.last_action = common.select_product;
        session.last_product.title = action_details.title;
        session.last_invoice.is_ordering = true;
        sendTextMessage(session.fbid, "Bắt đầu đặt hàng. " +
            common.pls_select_product_color, function () {
                show_available_colorNsize(session, true, false);
            });
    } else if (session.last_invoice.is_ordering &&
        (user_action.indexOf(common.action_continue_search) >= 0)) {
        session.last_action = common.say_greetings;
        sendTextMessage(session.fbid, common.pls_select_product);
    } else if (user_action.indexOf(common.action_purchase) >= 0) {
        session.last_action = common.set_quantity;
        sendTextMessage(session.fbid, common.pls_enter_name);
    } else if (user_action.indexOf(common.action_confirm_order) >= 0) {
        session.last_invoice.status = "confirm";
        g_model_factory.update_invoice(session.last_invoice, function (invoice) {
            logger.info(invoice);
            user_sessions[session.sessionId] = initSession(session.fbid);
            sendTextMessage(session.fbid, common.pls_select_product);
        });
    } else if (user_action.indexOf(common.action_cancel_order) >= 0) {
        g_model_factory.cancel_invoice(session.last_invoice.id, "cancel", function (invoice) {
            if (invoice != null) {
                user_sessions[session.sessionId] = initSession(session.fbid);
                sendTextMessage(session.fbid, common.say_greetings);
            }
        });
    } else {
        logger.error("Unknow action: " + JSON.stringify(action_details));
    }
}

function processEvent(event) {
    var sender = event.sender.id.toString();
    const sessionId = findOrCreateSession(sender);
    var current_session = user_sessions[sessionId];
    if (event.message) {
        if (event.message.text) {
            var text = event.message.text;
            // Handle a text message from this sender
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

function doSubscribeRequest() {
    request({
        method: 'POST',
        uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + FB_PAGE_ACCESS_TOKEN
    },
        function (error, response, body) {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
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
            doSubscribeRequest();
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
                var product_object = createProductElement(
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
            sendTextMessage(session.fbid, common.notify_product_notfound);
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
    start: function (home_page, product_code_pattern,
        products_finder, model_factory) {
        g_product_finder = products_finder;
        g_home_page = home_page;
        g_product_code_pattern = product_code_pattern;

        doSubscribeRequest();
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
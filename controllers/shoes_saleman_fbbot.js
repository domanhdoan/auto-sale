var bodyParser = require('body-parser');
var express = require('express');
var server = express();
var validator = require("email-validator");
var request = require('request');
var translator = require('speakingurl').createSlug({ maintainCase: true, separator: " " });
var common = require("../util/common");
var config = require("../config/config.js");
var logger = require("../util/logger.js");

// var wit_bot = require('./weather_witbot.js');
// var wit_bot = require('./shoes_saleman_witbot.js');

var g_store_id = "";
var g_home_page = "";
var g_search_path = "";
var g_product_finder = null;
var g_model_factory = require("../models/model_factory.js");
var g_product_code_pattern = "";

// var g_token = "EAAPsuaR9aooBAFHiRys6jXnUX91lt7evfByO7Hc42qcPZBgeA3dHq18C0LvEwjuaXodnliKZAOs0RZAfxgQ6v7Q9SFhvGZCzrHalj3myhjzrtmeKfSXZCvZBaZBla0zrhvZB17Njru2p1xWgkSKmVZB59yXBFaXt9gOr6kFmAZBHukPAZDZD";
const user_sessions = {};

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================

function createProductElement(title, price, thumbnail_url, link, code, id) {
    var payload = {};
    payload.id = id;
    payload.code = code;
    payload.action = "select";
    var template = {
        "title": title,
        "subtitle": price,
        "image_url": thumbnail_url,
        "buttons": [{
            "type": "web_url",
            "url": link,
            "title": "Chi tiết"
        },
            {
                "type": "postback",
                "title": "Đặt hàng",
                "payload": JSON.stringify(payload),
            }],
    };
    return template;
}

function createSearchOrPurchaseElement() {
    var order_action = {};
    var search_action = {};
    search_action.action = "search";
    order_action.action = "order";
    var template = [{
        "type": "postback",
        "title": "Thêm sản phẩm",
        "payload": JSON.stringify(search_action),
    },
        {
            "type": "postback",
            "title": "Đặt hàng",
            "payload": JSON.stringify(order_action),
        }];
    return template;
}

function sendDataToFBMessenger(sender, data) {
    logger.info("Data = " + JSON.stringify(data));

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: config.network.fb_token },
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
            //logger.info(response);
        }
    });
}

function sendTextMessage(sender, simple_text) {
    var messageData = {
        text: simple_text
    }
    console.log("Sender = " + sender);
    sendDataToFBMessenger(sender, messageData);
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
    sendDataToFBMessenger(sender, messageData);
}

function sendConfirmMessage(sender, buttons) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": "Bạn muốn tiếp tục chọn thêm sản phẩm khác?",
                "buttons": buttons
            }
        }
    };
    sendDataToFBMessenger(sender, messageData);
}

function createOrderItemElement(title, desc, price, quantity, thumbnail_url) {
    var template = {
        "title": title,
        "subtitle": desc,
        "quantity": quantity,
        "price": price,
        "currency": "VND",
        "image_url": thumbnail_url
    };
    return template;
}

function sendReceiptMessage(sender, order_items, invoice_details) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "receipt",
                "recipient_name": invoice_details.name,
                "order_number": invoice_details.id,
                "currency": "VND",
                "payment_method": "COD",
                "order_url": "",
                "timestamp": invoice_details.creation,
                "elements": order_items,
                "address": {
                    "street_1": "1 Hacker Way",
                    "street_2": "",
                    "city": "Menlo Park",
                    "postal_code": "94025",
                    "state": "CA",
                    "country": "US"
                },
                "summary": {
                    "subtotal": 75.00,
                    "shipping_cost": 4.95,
                    "total_tax": 6.19,
                    "total_cost": 56.14
                },
                "adjustments": [
                    {
                        "name": "New Customer Discount",
                        "amount": 20
                    },
                    {
                        "name": "$10 Off Coupon",
                        "amount": 10
                    }
                ]
            }
        }
    }
    sendDataToFBMessenger(sender, messageData);
}
// =================================================================
// Methods for managing user sessions
// =================================================================
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
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
        user_sessions[sessionId] = {
            fbid: fbid,
            context: {},
            last_product: {
                id: -1,
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
                is_ordering: false
            }
        };
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
    common.generate_remoteimg_hash(user_msg,
        function (hash) {
            g_product_finder.findProductByFinger(hash, function (product) {
                var found_products = [];
                //console.log(JSON.stringify(products[i]));
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

function execute_search_product(session, user_msg, user_msg_trans) {
    //sendTextMessage(session.fbid, common.say_waiting_message);
    // Search products
    var result = common.extract_product_code(user_msg, g_product_code_pattern);
    if (common.is_url(user_msg)) {
        find_products_by_image(session, user_msg);
    } else if (result.is_code) {
        find_products_by_code(session, result.code);
    } else {
        find_products_by_keywords(session, user_msg_trans);
    }
}

function execute_select_product(session, text) {
    var user_req_trans = translator(text).toLowerCase();
    if (session.last_action == common.select_product) {
        var color_keyword = user_req_trans.replaceAll("mau", "").replaceAll(" ", "");
        g_product_finder.checkProductByColor(session.last_product.id,
            color_keyword, function (color) {
                if (color != null) {
                    session.last_action = common.select_product_color;
                    session.last_product.color = color.dataValues.id;
                    sendTextMessage(session.fbid, common.pls_select_product_size);
                    g_product_finder.getProductSizes(session.last_product.id,
                        function (sizes) {
                            if (sizes != null && sizes.length > 0) {
                                var available_sizes = "";
                                for (var i = 0; i < (sizes.length - 1); i++) {
                                    logger.info("Available Size: " + sizes[i].dataValues.value);
                                    available_sizes += sizes[i].dataValues.value + ", ";
                                }
                                available_sizes += sizes[(sizes.length - 1)].dataValues.value;
                                sendTextMessage(session.fbid, "Size có sẵn: " + available_sizes);
                            } else {
                                logger.info("No Available Size for Product");
                                sendTextMessage(session.fbid, common.notify_product_notfound);
                                session.last_action = common.say_greetings;
                            }
                        });
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(session.fbid, common.notify_product_notfound);
                }
            });
    } else if (session.last_action == common.select_product_color) {
        g_product_finder.checkProductBySize(session.last_product.id,
            text, function (size) {
                if (size != null) {
                    session.last_action = common.select_product_size;
                    session.last_product.size = size.dataValues.id;
                    // sendTextMessage(current_session.fbid, common.notify_product_found);
                    sendTextMessage(session.fbid, common.pls_enter_quantity);
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(session.fbid, common.notify_product_notfound);
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

function execute_order_product(session, text) {
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
            session.last_action = common.set_email;
            sendTextMessage(session.fbid, common.pls_enter_delivery_date);
        } else {
            sendTextMessage(session.fbid, common.pls_enter_email);
        }
    } else if (session.last_action == common.set_email) {
        logger.debug("Delivery: " + text);
        session.last_invoice.delivery = text;
        session.last_action = common.set_delivery_date;
    } else if (session.last_action == common.set_delivery_date) {
        sendTextMessage(session.fbid, common.pls_end_buying);
        session.last_action = common.pls_end_buying;
    } else if (session.last_action == common.pls_end_buying) {
        if (text.toLowerCase() === common.action_confirm_order) {
            session.last_invoice.status = "confirm";
            g_model_factory.update_invoice(session.last_invoice, function (invoice) {
                logger.info(invoice);
            });
        } else {

        }
        session.last_invoice.is_ordering = false;
        session.last_action = common.say_greetings;
        sendTextMessage(session.fbid, common.pls_select_product);
    } else {

    }
}

function execute_saleflow_simple(session, user_msg, action_details) {
    var user_req_trans = translator(user_msg).toLowerCase();
    var last_action_key = session.last_action;
    var last_action = common.sale_steps.get(last_action_key);

    if (action_details != null) { /*Handle call-to-action buttons*/
        if (session.last_invoice.is_ordering &&
            (user_msg.indexOf(common.action_continue_search) >= 0)) {
            session.last_action = common.say_greetings;
            //sendTextMessage(session.fbid, common.say_search_continue_message);
            sendTextMessage(session.fbid, common.pls_select_product);
        } else if (user_msg.indexOf(common.action_select) >= 0) {
            session.last_product.id = action_details.id;
            session.last_action = common.select_product;
            g_product_finder.getProductColors(session.last_product.id,
                function (colors) {
                    if (colors != null && colors.length > 0) {
                        var available_colors = "";
                        for (var i = 0; i < (colors.length - 1); i++) {
                            available_colors += common.get_color_vn(colors[i].dataValues.name) + ", ";
                        }
                        available_colors += common.get_color_vn(colors[(colors.length - 1)].dataValues.name);
                        sendTextMessage(session.fbid, "Màu có sẵn: " + available_colors);
                        sendTextMessage(session.fbid, common.pls_select_product_color);
                    } else {
                        sendTextMessage(session.fbid, common.notify_product_notfound);
                        session.last_action = common.say_search_continue_message;
                        session.last_action = common.say_greetings;
                    }
                });
        } else if (user_msg.indexOf(common.action_order) >= 0) {
            session.last_action = common.set_quantity;
            session.last_invoice.is_ordering = true;
            sendTextMessage(session.fbid, common.pls_enter_name);
        } else {

        }
    } else if (user_req_trans.indexOf(common.cmd_terminate_order) >= 0) {
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
        && (last_action <= common.sale_steps.get(common.select_product_size))) {
        execute_select_product(session, user_msg);
    } else {
        execute_order_product(session, user_msg);
    }
}

server.get(config.network.fb_webhook, bodyParser.json(), function (req, res) {
    if (req.query['hub.verify_token'] === 'verify_me') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
});

server.post(config.network.fb_webhook, bodyParser.json(), function (req, res) {
    if (req.body != null) {
        messaging_events = req.body.entry[0].messaging;
        const messaging = getFirstMessagingEntry(req.body);
        for (i = 0; i < messaging_events.length; i++) {
            event = req.body.entry[0].messaging[i];
            sender = event.sender.id;

            const sessionId = findOrCreateSession(sender);
            var current_session = user_sessions[sessionId];
            if (event.message && event.message.text) {
                text = event.message.text;
                // We retrieve the user's current session, or create one if it doesn't exist
                // This is needed for our bot to figure out the conversation history

                // Flow 1: user not send product image and work with WIT
                // execute_saleflow_wit(sessionId, text, user_sessions);

                // Flow 2: simple and popular used in communicating 
                // between shopper and buyer (just use texting)
                execute_saleflow_simple(current_session, text, null);
            } else if (event.message && event.message.attachments != null) {
                var attachments = event.message.attachments;
                // handle the case when user send an image for searching product
                for (var i = 0; i < attachments.length; i++) {
                    if (attachments[i].type === 'image') {
                        execute_saleflow_simple(current_session, attachments[i].payload.url, null);
                    } else {
                        logger.info("Skipp to handle attachment");
                    }
                }
            } else if (event.postback) {
                var postback = JSON.parse(event.postback.payload);
                var delta = event.timestamp - current_session.timestamp;
                if (delta > 150 /*avoid double click*/) {
                    current_session.timestamp = event.timestamp;
                    execute_saleflow_simple(current_session, postback.action, postback);
                } else {
                    logger.info("Skipp to handle double click");
                }
            } else if (event.delivery) {

            } else if (event.optin) {

            } else {

            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

module.exports = {
    start: function (port, home_page, product_code_pattern, 
        products_finder, model_factory) {

        g_product_finder = products_finder;
        g_home_page = home_page;
        g_product_code_pattern = product_code_pattern;

        server.use(bodyParser.urlencoded({ extended: true }));
        server.listen(port, function () {
            console.log('FB BOT ready to go!');
        });

        g_product_finder.findStoreByLink(home_page, 
            function (store) {
            g_store_id = store.dataValues.id;
        });

        g_model_factory = model_factory;
    }
}
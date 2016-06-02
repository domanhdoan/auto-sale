var bodyParser = require('body-parser');
var express = require('express');
var server = express();
var store_id = "";
var common = require("../util/common");
var validator = require("email-validator");
var translator = require('speakingurl').createSlug({ maintainCase: true, separator: " " });

// var wit_bot = require('./weather_witbot.js');
// var wit_bot = require('./shoes_saleman_witbot.js');

var home_page = "";
var g_search_path = "";
var g_product_finder = null;
var g_model_factory = require("../models/model_factory.js");

var request = require('request');
var logger = require("../util/logger.js");
var token = "EAAPsuaR9aooBANEsp0QF7xYFHCOVERafKywE84OP6dfAwnOsHoXzNZAIRmpBWWvxSKG9nceykrKZCHHlERwjIkVFwUVfe1QHlCqQYZBblol3Vo2JHI5mdDZBVKxnVF8LU6tZCZCEVR5UQ7GyPG25p9dc8548Bpti7GfVwppaPmkwZDZD";
const user_sessions = {};
var FB_PAGE_ID = 123456789;

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================

function createProductElement(title, subtitle, thumbnail_url, link, code, id) {
    var template = {
        "title": title,
        "subtitle": subtitle,
        "image_url": thumbnail_url,
        "buttons": [{
            "type": "web_url",
            "url": link,
            "title": "Xem chi tiết"
        },
            {
                "type": "postback",
                "title": "Đặt hàng",
                "payload": {
                    code: code,
                    id: id
                },
            }],
    };
    return template;
}

function sendDataToFBMessenger(token, sender, data) {
    logger.info("Data = " + JSON.stringify(data));

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
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
            logger.info(response);
        }
    });
}

function sendTextMessage(sender, simple_text) {
    messageData = {
        text: simple_text
    }
    sendDataToFBMessenger(token, sender, messageData);
}

function sendGenericMessage(sender, rich_data) {
    messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    sendDataToFBMessenger(token, sender, messageData);
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
        body.entry[0].id === FB_PAGE_ID &&
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
            last_invoice: {
                id: -1,
                name: "",
                phone: "",
                address: "",
                delivery: "",
                email: "",
                status: ""
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

function find_products_by_keywords(sessionId, message) {
    g_product_finder.findShoesByKeywords(message, function (products) {
        var product_count = (products.length > 5) ? 5 : products.length;
        if (products.length > 0) {
            // user_sessions[sessionId].last_action = common.find_product;
            var found_products = [];
            for (var i = 0; i < product_count; i++) {
                var product_object = createProductElement(
                    products[i].title,
                    products[i].desc,
                    products[i].thumbnail.replaceAll("%%", "-"),
                    products[i].link.replaceAll("%%", "-"),
                    products[i].code,
                    products[i].id);
                found_products.push(product_object);
            }
            sendGenericMessage(user_sessions[sessionId].fbid, found_products);
        } else {
            sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
        }
    });
}

function find_products_by_code(sessionId, message) {
    g_product_finder.findProductsByCode(message, function (product) {
        if (product != null) {
            // user_sessions[sessionId].last_action = common.find_product;
            user_sessions[sessionId].last_product.id = product.dataValues.id;
            var found_products = [];
            var product_object = createProductElement(
                product.dataValues.title,
                product.dataValues.desc,
                product.dataValues.thumbnail.replaceAll("%%", "-"),
                product.dataValues.link.replaceAll("%%", "-"),
                product.dataValues.code,
                product.dataValues.id);
            found_products.push(product_object);
            sendGenericMessage(user_sessions[sessionId].fbid, found_products);
            sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product_color);
        } else {
            logger.debug("Product not found");
            sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
        }
    });
}

function find_categories(sessionId) {
    g_product_finder.findCategoriesByStoreId(store_id, function (categories) {
        for (var i = 0; i < categories.length; i++) {
            console.log(categories[i].dataValues.name.trim());
        }
        user_sessions[sessionId].last_action = common.find_categories;
        decide_next_action(sessionId);
    });
}

function execute_product_order(sessionId, text) {
    if (user_sessions[sessionId].last_action == common.select_product_size) {
        logger.debug("Order Quantity: " + text);
        g_model_factory.create_fashion_item(parseInt(text),
            user_sessions[sessionId].last_invoice.id,
            user_sessions[sessionId].last_product.id,
            user_sessions[sessionId].last_product.color,
            user_sessions[sessionId].last_product.size,
            function (saved_item) {
                logger.info("saved_item: " + saved_item);
            });

        user_sessions[sessionId].last_action = common.set_quantity;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_name);
    } else if (user_sessions[sessionId].last_action == common.set_quantity) {
        logger.debug("Name: " + text);
        user_sessions[sessionId].last_action = common.set_recipient_name;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_phone);
        user_sessions[sessionId].last_invoice.name = text;
    } else if (user_sessions[sessionId].last_action == common.set_recipient_name) {
        logger.debug("Phone: " + text);
        user_sessions[sessionId].last_action = common.set_phone;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_address);
        user_sessions[sessionId].last_invoice.phone = text;
    } else if (user_sessions[sessionId].last_action == common.set_phone) {
        logger.debug("Address: " + text);
        user_sessions[sessionId].last_action = common.set_address;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_email);
        user_sessions[sessionId].last_invoice.address = text;
    } else if (user_sessions[sessionId].last_action == common.set_address) {
        logger.debug("Email: " + text);
        var is_valid_email = validator.validate(text);
        if (is_valid_email) {
            user_sessions[sessionId].last_invoice.email = text;
            user_sessions[sessionId].last_action = common.set_email;
            sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_delivery_date);
        } else {
            sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_email);
        }
    } else if (user_sessions[sessionId].last_action == common.set_email) {
        logger.debug("Delivery: " + text);
        user_sessions[sessionId].last_action = common.set_delivery_date;
        user_sessions[sessionId].last_invoice.delivery = text;
    } else if (user_sessions[sessionId].last_action == common.set_delivery_date) {
        sendTextMessage(user_sessions[sessionId].fid, common.pls_end_buying);
        user_sessions[sessionId].last_action = common.pls_end_buying;
    } else if (user_sessions[sessionId].last_action == common.pls_end_buying) {
        if(text.toLowerCase() === common.cmd_confirm_order){           
            user_sessions[sessionId].last_invoice.status = "confirm";
            g_model_factory.update_invoice(user_sessions[sessionId].last_invoice, function (invoice) {
                logger.info(invoice);
            });
        }
    } else {

    }
}

function execute_product_search(sessionId, text, image_search_flag){
    sendTextMessage(user_sessions[sessionId].fid, common.say_waiting_message);
    // Search products
    if (image_search_flag) {
        common.generate_remoteimg_hash(text,
            function (hash) {
                g_product_finder.findProductByFinger(hash, function (product) {
                    var found_products = [];
                    //console.log(JSON.stringify(products[i]));
                    var product_object = createProductElement(
                        product.dataValues.title,
                        product.dataValues.desc,
                        product.dataValues.thumbnail.replaceAll("%%", "-"),
                        product.dataValues.link.replaceAll("%%", "-"),
                        product.dataValues.code,
                        product.dataValues.id);
                    found_products.push(product_object);
                    user_sessions[sessionId].last_product.id = product.dataValues.id;
                    sendGenericMessage(user_sessions[sessionId].fbid, found_products);
                });
            });
    } else if (text.trim().indexOf(" ") > 0) {
        find_products_by_keywords(sessionId, text);
    } else {
        find_products_by_code(sessionId, text);
    }
}
function execute_saleflow_simple(sessionId, text, image_search_flag) {
    var user_req_trans = translator(text).toLowerCase();
    if (user_req_trans.indexOf(common.cmd_terminate_order) >= 0) {
        user_sessions[sessionId].last_product.id = -1;
        user_sessions[sessionId].last_invoice.id = -1;
        user_sessions[sessionId].last_invoice.status = "cancel";
        sendTextMessage(user_sessions[sessionId].fid, common.pls_reset_buying);
        user_sessions[sessionId].last_action = common.say_greetings;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product);
    } else if (user_sessions[sessionId].last_action == common.say_greetings) {
        execute_product_search(sessionId, user_req_trans, image_search_flag);
    } else if (user_req_trans.indexOf(common.cmd_continue_search) >= 0) {
        sendTextMessage(user_sessions[sessionId].fid, common.say_search_continue_message);
        user_sessions[sessionId].last_action = common.say_greetings;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product);
    } if (user_req_trans.indexOf(common.cmd_terminate_order) >= 0) {
        user_sessions[sessionId].last_product.id = -1;
        user_sessions[sessionId].last_invoice.id = -1;
        user_sessions[sessionId].last_invoice.status = "cancel";
        sendTextMessage(user_sessions[sessionId].fid, common.pls_reset_buying);
        user_sessions[sessionId].last_action = common.say_greetings;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product);
    } else if (user_sessions[sessionId].last_action == common.select_product) {
        var color_keyword = user_req_trans.replaceAll("mau", "").replaceAll(" ", "");
        
        g_product_finder.checkProductByColor(user_sessions[sessionId].last_product.id,
            color_keyword, function (color) {
                if (color != null) {
                    user_sessions[sessionId].last_action = common.select_product_color;
                    user_sessions[sessionId].last_product.color = color.dataValues.id;

                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_found);
                    sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product_size);
                    g_product_finder.getProductSizes(user_sessions[sessionId].last_product.id,
                        function (sizes) {
                            if (sizes != null) {
                                for (var i = 0; i < sizes.length; i++) {
                                    logger.info("Available Size: " + sizes[i].dataValues.value);
                                }
                            } else {
                                logger.info("No Available Size for Product");
                            }
                        });
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
                }
            });
    } else if (user_sessions[sessionId].last_action == common.select_product_color) {
        g_product_finder.checkProductBySize(user_sessions[sessionId].last_product.id,
            text, function (size) {
                if (size != null) {
                    user_sessions[sessionId].last_action = common.select_product_size;
                    user_sessions[sessionId].last_product.size = size.dataValues.id;
                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_found);
                    sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_quantity);
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
                }
            });
    } else {
        execute_product_order(sessionId, text);
    }
}

server.get('/webhook/', bodyParser.json(), function (req, res) {
    if (req.query['hub.verify_token'] === 'verify_me') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
});

server.post('/webhook/', bodyParser.json(), function (req, res) {
    if (req.body == null) {
        res.sendStatus(404);
    } else {

        messaging_events = req.body.entry[0].messaging;

        const messaging = getFirstMessagingEntry(req.body);

        for (i = 0; i < messaging_events.length; i++) {
            event = req.body.entry[0].messaging[i];
            sender = event.sender.id;

            const sessionId = findOrCreateSession(sender);
            if (event.message && event.message.text) {
                text = event.message.text;
                // We retrieve the user's current session, or create one if it doesn't exist
                // This is needed for our bot to figure out the conversation history

                // Flow 1: user not send product image and work with WIT
                // execute_saleflow_wit(sessionId, text, user_sessions);

                // Flow 2: simple and popular used in communicating 
                // between shopper and buyer (just use texting)
                execute_saleflow_simple(sessionId, text, false)
            } else if (event.message && event.message.attachments != null) {
                var attachments = event.message.attachments;
                // handle the case when user send an image for searching product
                for (var i = 0; i < attachments.length; i++) {
                    if (attachments[i].type === 'image') {
                        execute_saleflow_simple(sessionId, attachments[i].payload.url, true);
                    } else {
                        logger.info("Skipp to handle attachment");
                    }
                }
            } else if (event.postback) {
                if (event.postback.payload.id != null) {
                    user_sessions[sessionId].last_product.id = event.postback.payload.id;
                    user_sessions[sessionId].last_action = common.select_product;
                    g_model_factory.create_empty_invoice(user_sessions[sessionId].fbid,
                        function (invoice) {
                            user_sessions[sessionId].last_invoice.id = invoice.id;
                        });
                    g_product_finder.getProductColors(event.postback.payload.id,
                        function (colors) {
                            if (colors != null) {
                                for (var i = 0; i < colors.length; i++) {
                                    logger.info("Available Color: " + colors[i].dataValues.name);
                                }
                            } else {
                                logger.info("No Available Color for Product");
                            }
                        });
                    sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product_color);

                } else {
                    // handle delivery time or address
                }
            } else if (event.delivery) {

            } else if (event.optin) {

            } else {

            }
        }
        res.sendStatus(200);
    }
});

module.exports = {
    start: function (port, home_page, search_prefix, products_finder, model_factory) {

        g_product_finder = products_finder;
        g_search_path = home_page + search_prefix;
        this.home_page = home_page;

        server.use(bodyParser.urlencoded({ extended: true }));

        server.listen(port, function () {
            console.log('FB BOT ready to go!');
        });

        g_product_finder.findStoreByLink(home_page, function (store) {
            store_id = store.dataValues.id;
        });

        g_model_factory = model_factory;

        //wit_bot.set_findcategories_cb(find_categories_cb);
        //wit_bot.set_findproducts_cb(find_product_bykeywords);
    }
}
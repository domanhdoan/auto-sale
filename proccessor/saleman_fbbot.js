var bodyParser = require('body-parser');
var express = require('express');
var server = express();
var store_id = "";
var common = require("../util/common");

// var intent_extractor = require('./weather_witbot.js');
var wit_bot = require('./shoes_saleman_witbot.js');

var home_page = "";
var g_search_path = "";
var g_products_finder = null;
var request = require('request');
var token = "EAANYeoVPMJcBAEc6wWojalF4prTtZAXNfAwit6Mr0awLGQh6LlTYoJNDoO21wZBGvc0wMEmSx0SVaVOFmlbRx1STBhwYT1jbHr0okvDfgsFOZB8KOWUE2ZCYpbvlZBHyDGtEVu6s1Tj3tRRiPvyIaXvk2YPpNRntZBPA50FHjFpAZDZD";
var logger = require("../util/logger.js");

function createFBMsgTemplate() {
    var template = {
        "title": "",
        "subtitle": "",
        "image_url": "",
        "buttons": [{
            "type": "",
            "url": "",
            "title": ""
        }, {
                "type": "",
                "title": "",
                "payload": "",
            }],
    };
    return template;
}

function sendDataToFBMessenger(token, sender, data) {
    logger.info("Data = " + JSON.stringify(data));

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        // url: 'http://localhost:8081/webhook/',
        qs: { access_token: token },
        method: 'POST',
        json: true,
        body: {
            recipient: { id: sender },
            message: data
        }
    }, function (error, response, body) {
        if (error) {
            logger.error('Error sending message: ', error.stack);
        } else if (response.body.error) {
            logger.error('Error: ', response.body.error);
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

const sessions = {};
var FB_PAGE_ID = 123456789;
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
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = {
            fbid: fbid, context: {},
            conversion: [],
            last_action: common.say_greetings,
            last_product_id: -1
        };
    }
    return sessionId;
};
function deteleSession(sessionId) {
    delete sessions[sessionId];
}

function decide_next_action(sessionId) {
    var current_session = sessions[sessionId];
    if (current_session.last_action == common.say_greetings) {
        sendTextMessage(sessions[sessionId].fid, common.pls_select_category);
    } else if (current_session.last_action == common.find_categories) {
        sendTextMessage(sessions[sessionId].fid, common.pls_select_category);
    } else if (current_session.last_action == common.find_product) {
        sendTextMessage(sessions[sessionId].fid, common.pls_select_product);
    } else if (current_session.last_action == common.select_product) {
        sendTextMessage(sessions[sessionId].fid, common.pls_select_product_color);
    } else if (current_session.last_action == common.select_product_color) {
        sendTextMessage(sessions[sessionId].fid, common.pls_select_product_size);
    } else if (current_session.last_action == common.select_product_size) {
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_quantity);

    } else if (current_session.last_action == common.set_quantity) {
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_name);
    } else if (current_session.last_action == common.set_recipient_name) {
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_phone);
    } else if (current_session.last_action == common.set_phone) {
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_address);
    } else if (current_session.last_action == common.set_address) {
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_email);
    } else if (current_session.last_action == common.set_email) {
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_delivery_date);
    } else if (current_session.last_action == common.set_delivery_date) {
        sendTextMessage(sessions[sessionId].fid, common.pls_end_buying);
    } else {
        logger.info("Can not decide next action from las action " + current_session.last_action);
    }
}

function findcategories_cb(sessionId) {
    g_products_finder.findCategoriesByStoreId(store_id, function (categories) {
        for (var i = 0; i < categories.length; i++) {
            console.log(categories[i].dataValues.name.trim());
        }
        sessions[sessionId].last_action = common.find_categories;
        decide_next_action(sessionId);
    });
}

function findproduct_bycategory_cb(sessionId, keywords) {
    g_products_finder.findProductsByKeywords(home_page + ""
        + g_search_path, keywords, function (products) {
            var length = products.length;
            for (var i = 0; i < length; i++) {
                console.log(products[i]);
            }
            if (length >= 1) {
                sessions[sessionId].last_action = common.find_product;
                decide_next_action(sessionId);
            } else {

            }
        });
}

function execute_saleflow_simple(sessionId, text){
    if (text.toLowerCase() === "huy") {
        sendTextMessage(sessions[sessionId].fid, common.pls_reset_buying);
        sessions[sessionId].last_action = common.say_greetings;
    } else if (sessions[sessionId].last_action == common.say_greetings) {
        sendTextMessage(sessions[sessionId].fid, common.pls_select_product);
        sessions[sessionId].last_action = common.pls_select_product;
    } else if (sessions[sessionId].last_action == common.pls_select_product) {
        // Search products
        g_products_finder.findProductsByCode(text, function (product) {
            if (product != null) {
                sessions[sessionId].last_action = common.find_product;
                sessions[sessionId].last_product_id = product.dataValues.id;
                logger.info(product.dataValues.title);
                logger.info(product.dataValues.price);
                logger.info(product.dataValues.desc);
                sendTextMessage(sessions[sessionId].fid, common.pls_select_product_color);
            } else {
                logger.debug("Product not found");
                sendTextMessage(sessions[sessionId].fid, common.notify_product_notfound);
            }
        });
    } else if (sessions[sessionId].last_action == common.find_product) {
        g_products_finder.checkProductByColor(sessions[sessionId].last_product_id,
            text, function (color) {
                if (color != null) {
                    sessions[sessionId].last_action = common.select_product_color;
                    sendTextMessage(sessions[sessionId].fid, common.notify_product_found);
                    sendTextMessage(sessions[sessionId].fid, common.pls_select_product_size);
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(sessions[sessionId].fid, common.notify_product_notfound);
                }
            });
    } else if (sessions[sessionId].last_action == common.select_product_color) {
        g_products_finder.checkProductBySize(sessions[sessionId].last_product_id,
            text, function (size) {
                if (size != null) {
                    sessions[sessionId].last_action = common.select_product_size;
                    sendTextMessage(sessions[sessionId].fid, common.notify_product_found);
                    sendTextMessage(sessions[sessionId].fid, common.pls_enter_quantity);
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(sessions[sessionId].fid, common.notify_product_notfound);
                }
            });
    } else if (sessions[sessionId].last_action == common.select_product_size) {
        logger.debug("Order Quantity: " + text);
        sessions[sessionId].last_action = common.set_quantity;
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_name);

    } else if (sessions[sessionId].last_action == common.set_quantity) {
        logger.debug("Name: " + text);
        sessions[sessionId].last_action = common.set_recipient_name;
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_phone);
    } else if (sessions[sessionId].last_action == common.set_recipient_name) {
        logger.debug("Phone: " + text);
        sessions[sessionId].last_action = common.set_phone;
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_address);
    } else if (sessions[sessionId].last_action == common.set_phone) {
        logger.debug("Address: " + text);
        sessions[sessionId].last_action = common.set_address;
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_email);
    } else if (sessions[sessionId].last_action == common.set_address) {
        logger.debug("Email: " + text);
        sessions[sessionId].last_action = common.set_email;
        sendTextMessage(sessions[sessionId].fid, common.pls_enter_delivery_date);
    } else if (sessions[sessionId].last_action == common.set_email) {
        logger.debug("Delivery: " + text);
        sessions[sessionId].last_action = common.set_delivery_date;
    } else if (sessions[sessionId].last_action == common.set_delivery_date) {
        sendTextMessage(sessions[sessionId].fid, common.pls_end_buying);
    } else {

    }
    logger.info("Session ID = " + sessionId);
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
            if (event.message && event.message.text) {
                // We retrieve the user's current session, or create one if it doesn't exist
                // This is needed for our bot to figure out the conversation history
                const sessionId = findOrCreateSession(sender);

                text = event.message.text;
                // Work dividor and search
                var word_list = text.split(" ");
                console.log("Word list = " + word_list);

                // Flow 1: user not send product image and work with WIT

                // Flow 2: simple and popular used in communicating 
                // between shopper and buyer
                execute_saleflow_simple(sessionId, text);
            }
        }
        res.sendStatus(200);
    }
});

module.exports = {
    start: function (port, home_page, search_prefix, products_finder) {

        g_products_finder = products_finder;
        g_search_path = home_page + search_prefix;
        this.home_page = home_page;

        server.use(bodyParser.urlencoded({ extended: true }));

        server.listen(port, function () {
            console.log('FB BOT ready to go!');
        });

        g_products_finder.findStoreByLink(home_page, function (store) {
            store_id = store.dataValues.id;
        });

        wit_bot.set_findcategories_cb(findcategories_cb);
        wit_bot.set_findproducts_cb(findproduct_bycategory_cb);
    }
}
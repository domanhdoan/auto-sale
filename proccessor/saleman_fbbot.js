var bodyParser = require('body-parser');
var express = require('express');
var server = express();
var store_id = "";
var common = require("../util/common");
var validator = require("email-validator");
var translator = require('speakingurl').createSlug({
    maintainCase: true,
    separator: " "
});

// var intent_extractor = require('./weather_witbot.js');
// var wit_bot = require('./shoes_saleman_witbot.js');

var home_page = "";
var g_search_path = "";
var g_products_finder = null;
var request = require('request');
var logger = require("../util/logger.js");
var token = "EAANYeoVPMJcBAEc6wWojalF4prTtZAXNfAwit6Mr0awLGQh6LlTYoJNDoO21wZBGvc0wMEmSx0SVaVOFmlbRx1STBhwYT1jbHr0okvDfgsFOZB8KOWUE2ZCYpbvlZBHyDGtEVu6s1Tj3tRRiPvyIaXvk2YPpNRntZBPA50FHjFpAZDZD";
const user_sessions = {};
var FB_PAGE_ID = 123456789;

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================

function createGenericElement(title, subtitle, thumbnail_url, link) {
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
            "payload": "payload",
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
    //messageData.attachment.payload.elements.push(rich_data);
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
            fbid: fbid, context: {},
            conversion: [],
            last_action: common.say_greetings,
            last_product_id: -1
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
function parse_keywords(word_list) {
    var keywords = ['giay', 'mau', 'size', 'co'];
    var result = {};
    var temp = "";
    var last_keyword = null;
    for (var i = 0; i <= word_list.length; i++) {
        if (keywords.indexOf(word_list[i]) >= 0 || i == word_list.length) {
            if (last_keyword != null) {
                console.log("key = " + last_keyword + " value = " + temp);
                result[last_keyword] = temp.trim();
            }
            temp = "";
            last_keyword = word_list[i];
        } else {
            temp += " " + word_list[i];
        }
    }
    return result;
}

function find_products_by_keywords(sessionId, message) {
    var trans_message = translator(message);
    var word_list = trans_message.split(" ");
    var results = parse_keywords(word_list);
    console.log(results);

    g_products_finder.findProductsByKeywords("", results['giay'].replaceAll(" ", "%%"), function (products) {
        var product_count = (products.length > 5) ? 5 : products.length;
        if (products != null) {
            user_sessions[sessionId].last_action = common.find_product;
            // user_sessions[sessionId].last_product_id = product.dataValues.id;
            // sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product_color);
            var found_products = [];
            for (var i = 0; i < product_count; i++) {
                //console.log(JSON.stringify(products[i]));
                var product_object = createGenericElement(
                        products[i].dataValues.title, 
                        products[i].dataValues.desc,
                        products[i].dataValues.thumbnail.replaceAll("%%", "-"),
                        products[i].dataValues.link.replaceAll("%%", "-"));
                found_products.push(product_object);
                sendGenericMessage(user_sessions[sessionId].fbid, found_products);
            }
        } else {
            console.log("product not found");
            sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
        }
    });
}

function find_products_by_code(sessionId, message) {
    g_products_finder.findProductsByCode(text, function (product) {
        if (product != null) {
            user_sessions[sessionId].last_action = common.find_product;
            user_sessions[sessionId].last_product_id = product.dataValues.id;
            var found_products = [];
            var product_object = createGenericElement(
                product.dataValues.title,
                product.dataValues.desc,
                product.dataValues.thumbnail.replaceAll("%%", "-"),
                product.dataValues.link.replaceAll("%%", "-"));
            found_products.push(product_object);
            sendGenericMessage(user_sessions[sessionId].fbid, found_products);
            sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product_color);
            g_products_finder.getProductColors(product.dataValues.id,
                function (colors) {
                    if (colors != null) {
                        for (var i = 0; i < colors.length; i++) {
                            logger.info("Available Color: " + colors[i].dataValues.name);
                        }
                    } else {
                        logger.info("No Available Color for Product");
                    }
                });
        } else {
            logger.debug("Product not found");
            sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
        }
    });
}

function find_categories(sessionId) {
    g_products_finder.findCategoriesByStoreId(store_id, function (categories) {
        for (var i = 0; i < categories.length; i++) {
            console.log(categories[i].dataValues.name.trim());
        }
        user_sessions[sessionId].last_action = common.find_categories;
        decide_next_action(sessionId);
    });
}

function execute_saleflow_simple(sessionId, text) {
    if (text.toLowerCase() === "huy") {
        sendTextMessage(user_sessions[sessionId].fid, common.pls_reset_buying);
        user_sessions[sessionId].last_action = common.say_greetings;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product);
    } else if (user_sessions[sessionId].last_action == common.say_greetings) {
        //     sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product);
        //     user_sessions[sessionId].last_action = common.pls_select_product;
        // } else if (user_sessions[sessionId].last_action == common.pls_select_product) {
        sendTextMessage(user_sessions[sessionId].fid, common.say_waiting_message);

        // Search products
        if (text.trim().indexOf(" ") > 0) {
            find_products_by_keywords(sessionId, text);
        } else {
            find_products_by_code(sessionId, text);
        }
    } else if (user_sessions[sessionId].last_action == common.find_product) {
        g_products_finder.checkProductByColor(user_sessions[sessionId].last_product_id,
            text, function (color) {
                if (color != null) {
                    user_sessions[sessionId].last_action = common.select_product_color;
                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_found);
                    sendTextMessage(user_sessions[sessionId].fid, common.pls_select_product_size);
                    g_products_finder.getProductSizes(user_sessions[sessionId].last_product_id,
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
        g_products_finder.checkProductBySize(user_sessions[sessionId].last_product_id,
            text, function (size) {
                if (size != null) {
                    user_sessions[sessionId].last_action = common.select_product_size;
                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_found);
                    sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_quantity);
                } else {
                    logger.debug("Product not found");
                    sendTextMessage(user_sessions[sessionId].fid, common.notify_product_notfound);
                }
            });
    } else if (user_sessions[sessionId].last_action == common.select_product_size) {
        logger.debug("Order Quantity: " + text);
        user_sessions[sessionId].last_action = common.set_quantity;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_name);
    } else if (user_sessions[sessionId].last_action == common.set_quantity) {
        logger.debug("Name: " + text);
        user_sessions[sessionId].last_action = common.set_recipient_name;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_phone);
    } else if (user_sessions[sessionId].last_action == common.set_recipient_name) {
        logger.debug("Phone: " + text);
        user_sessions[sessionId].last_action = common.set_phone;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_address);
    } else if (user_sessions[sessionId].last_action == common.set_phone) {
        logger.debug("Address: " + text);
        user_sessions[sessionId].last_action = common.set_address;
        sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_email);
    } else if (user_sessions[sessionId].last_action == common.set_address) {
        logger.debug("Email: " + text);
        var is_valid_email = validator.validate(text);
        if (is_valid_email) {
            user_sessions[sessionId].last_action = common.set_email;
            sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_delivery_date);
        } else {
            sendTextMessage(user_sessions[sessionId].fid, common.pls_enter_email);
        }
    } else if (user_sessions[sessionId].last_action == common.set_email) {
        logger.debug("Delivery: " + text);
        user_sessions[sessionId].last_action = common.set_delivery_date;
    } else if (user_sessions[sessionId].last_action == common.set_delivery_date) {
        sendTextMessage(user_sessions[sessionId].fid, common.pls_end_buying);
    } else {

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
            if (event.message && event.message.text) {
                // We retrieve the user's current session, or create one if it doesn't exist
                // This is needed for our bot to figure out the conversation history
                const sessionId = findOrCreateSession(sender);

                text = event.message.text;
                // Work dividor and search
                var word_list = text.split(" ");
                console.log("Word list = " + word_list);

                // Flow 1: user not send product image and work with WIT
                // execute_saleflow_wit(sessionId, text, user_sessions);

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

        //wit_bot.set_findcategories_cb(find_categories_cb);
        //wit_bot.set_findproducts_cb(find_product_bykeywords);
    }
}
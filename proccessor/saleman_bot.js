var bodyParser = require('body-parser');
var express = require('express');
var server = express();
var intent_extractor = require('./shoes_sale_witbot.js');

var home_page = "";
var g_search_path = "";
var g_products_finder = null;

function createProductInfoTemplate() {
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
var request = require('request');
var token = "EAANYeoVPMJcBAEc6wWojalF4prTtZAXNfAwit6Mr0awLGQh6LlTYoJNDoO21wZBGvc0wMEmSx0SVaVOFmlbRx1STBhwYT1jbHr0okvDfgsFOZB8KOWUE2ZCYpbvlZBHyDGtEVu6s1Tj3tRRiPvyIaXvk2YPpNRntZBPA50FHjFpAZDZD";
var logger = require("../util/logger.js");

function sendDataViaFBMessenger(token, sender, data){
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: token },
        method: 'POST',
        json: {
            recipient: { id: sender },
            message: data
        }
    }, function (error, response, body) {
        if (error) {
            logger.error('Error sending message: ', error);
        } else if (response.body.error) {
            logger.error('Error: ', response.body.error);
        }
    });
}

function functionsendTextMessage(sender, simple_text) {
    messageData = {
        text: simple_text
    }
    sendDataViaFBMessenger(token, sender, messageData);
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
    sendDataViaFBMessenger(token, sender, messageData);
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
        sessions[sessionId] = { fbid: fbid, context: {} };
    }
    return sessionId;
};

server.post('/search/', bodyParser.json(), function (req, res) {
    // Work dividor and search
    // var keywords_search = "s=giay+nu&color=do";
    // var url = "http://bluewind.vn";
    // g_products_finder.findProductsByKeywords(home_page + ""
    //     + g_search_path, keywords_search, function (products) {
    //         var length = products.length;
    //         for (var i = 0; i < length; i++) {
    //             console.log(products[i]);
    //         }
    //     });
});


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
                
                intent_extractor.extract_intent(sessionId, text, sessions);
                
                //const atts = messaging.message.attachments;
            }
        }
        res.sendStatus(200);
    }
});

module.exports = {
    start: function (port, search_path, products_finder) {
        g_products_finder = products_finder;
        g_search_path = search_path;
        server.use(bodyParser.urlencoded({ extended: true }));
        server.listen(port, function () {
            console.log('ready to go!');
        });
    }
}
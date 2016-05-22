var bodyParser = require('body-parser');
var express = require('express');
var server = express();
var messenger = require('./fbmessage_sender.js');
var products_search = require('./product_search_engine.js');

var home_page = "";
var g_search_path = "";
var g_products_finder = null;

function createProductInfoTemplate(){
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

server.post('/search/', function (req, res) {
    // Work dividor and search
    var text_search = "giay";
    var url = "http://bluewind.vn";
    g_products_finder.findAllCategories(url, function(){
        
    });
});


server.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'verify_me') {
        res.send(req.query['hub.challenge']);
    }
    res.send('Error, wrong validation token');
});

server.post('/webhook/', function (req, res) {
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
        if (event.message && event.message.text) {
            text = event.message.text;
            text = text.toLowerCase();
            // Work dividor and search
            var word_list = text.split(" ");
        }
    }
    res.sendStatus(200);
});

module.exports = {
    start: function (port, search_path, products_finder) {
        g_products_finder = products_finder;
        g_search_path = search_path;
        server.use(bodyParser.urlencoded({ extended: false }));
        server.use(bodyParser.json());
        server.use(bodyParser.text());
        server.listen(port, function () {
            console.log('ready to go!');
        });
    }
}
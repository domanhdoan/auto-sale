var bodyParser = require('body-parser');
var messenger = require('./message_sender.js');
var express = require('express');
var server = express();

var home_page = "";
var g_search_path = "";
var g_crawler = null;

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
    res.send('hello');
    //console.log(req.body.content);
    // Work dividor and search
    //var word_list = req.body.split(" ");
    var text_search = "giay";
    console.log(g_search_path+text_search);
    var products = g_crawler.crawl_alink_nodepth(g_search_path+text_search);
    console.log(products);
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
    init: function (port, search_path) {
        g_search_path = search_path;
        server.use(bodyParser.urlencoded({ extended: false }));
        server.use(bodyParser.json());
        server.use(bodyParser.text());
        server.listen(port, function () {
            console.log('ready to go!');
        });
    },
    set_crawler: function (crawler){
        g_crawler = crawler;
    }
}
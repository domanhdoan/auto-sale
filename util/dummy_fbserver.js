var express = require('express');
var server = express();
var bodyParser = require('body-parser');

server.post('/webhook/', bodyParser.json(), function (req, res) {
    if (req.body == null) {
        res.sendStatus(404);
    } else {
        console.log("message = " + req.body.message.text);
        res.sendStatus(200);
    }
});

module.exports = {
    start: function (port) {
        server.use(bodyParser.urlencoded({ extended: true }));
        server.listen(port, function () {
            console.log('dummy FB server ready to go!');
        });
    }
}
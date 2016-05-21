var request = require('request');
var token = "EAANYeoVPMJcBAEc6wWojalF4prTtZAXNfAwit6Mr0awLGQh6LlTYoJNDoO21wZBGvc0wMEmSx0SVaVOFmlbRx1STBhwYT1jbHr0okvDfgsFOZB8KOWUE2ZCYpbvlZBHyDGtEVu6s1Tj3tRRiPvyIaXvk2YPpNRntZBPA50FHjFpAZDZD";

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
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
}

module.exports = {
    sendTextMessage: function (sender, simple_text) {
        messageData = {
            text: simple_text
        }
        sendDataViaFBMessenger(token, sender, messageData);
    },

    sendGenericMessage: function (sender, rich_data) {
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
};
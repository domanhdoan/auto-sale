var config = require('../config/config.js');
var common = require('../util/common.js');
var logger = require('../util/logger.js');
var apiai = require('apiai');
var express = require('express');
var bodyParser = require('body-parser');

var uuid = require('node-uuid');
var async = require('async');

var APIAI_ACCESS_TOKEN = config.bots.ai_token;
var APIAI_LANG = config.bots.ai_lang;
var FB_VERIFY_TOKEN = config.bots.fb_verify_token;

function UserIntentParserAIAPI() {
    var apiAiService = apiai(APIAI_ACCESS_TOKEN, {
        language: APIAI_LANG,
        requestSource: "fb"
    });

    this.aiSessionIds = new Map();
    var ai_webhook = express();
    ai_webhook.use(bodyParser.json());

    ai_webhook.post(config.bots.ai_webhook, function(req, res) {
        // get the parameters
        var action = req.body.result.action
        action = req.body.result.action
        console.log("request action: ", action);
    });
    ai_webhook.listen(config.bots.ai_port);

    this.sendRequestToAIService = function(text, sender) {
        if (!aiSessionIds.has(sender)) {
            aiSessionIds.set(sender, uuid.v1());
        }
        var apiaiRequest = apiAiService.textRequest(text, {
            sessionId: aiSessionIds.get(sender)
        });

        apiaiRequest.on('response', (response) => {
            if (common.isDefined(response.result)) {
                let responseText = response.result.fulfillment.speech;
                let responseData = response.result.fulfillment.data;
                let action = response.result.action;

                console.log("response fulfillment: ", response.result.fulfillment);
                console.log("response data: ", responseData);

                if (isDefined(responseData) && isDefined(responseData.facebook)) {
                    try {
                        console.log('Response as formatted message');
                        //fbMessenger.sendTextMessage(sender, responseData.facebook);
                        sendDataToFBMessenger(sender, responseData.facebook)
                    } catch (err) {
                        fbMessenger.sendTextMessage(sender, {
                            text: err.message
                        });
                    }
                } else if (isDefined(responseText)) {
                    console.log('Response as text message');
                    // facebook API limit for text length is 320,
                    // so we split message if needed
                    var splittedText = common.splitResponse(responseText);
                    async.eachSeries(splittedText, (textPart, callback) => {
                        fbMessenger.sendTextMessage(sender, textPart);
                    });
                }
            }
        });

        apiaiRequest.on('error', (error) => console.error(error));
        apiaiRequest.end();
    }
}

var method = UserIntentParserAIAPI.prototype

method.parse = function(userMsg, codePattern) {

}
module.exports = UserIntentParserAIAPI;
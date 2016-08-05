var logger = require('../util/logger.js')
var common = require('../util/common.js')

var UserIntentParserNLP = require("../processors/user_intent_parser_nlp.js");
var UserIntentParserAIAPI = require("../processors/user_intent_parser_aiapi.js");

function ParserFactory() {}

ParserFactory.prototype.createParser = function(type) {
    var parser = null;
    switch (type) {
        case ParserFactory.CONSTANT.AI_PARSER:
            parser = new UserIntentParserAIAPI();
            break;
        case ParserFactory.CONSTANT.REGEXP_PARSER:
            parser = new UserIntentParserNLP();
            break;
        default:
            logger.error("Can not create new parser");
    }
    return parser;
}

module.exports = ParserFactory;
module.exports.CONSTANT = {
    AI_PARSER: 1,
    REGEXP_PARSER: 2
};

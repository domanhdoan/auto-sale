var logger = require('../util/logger.js')
var common = require('../util/common.js')

function UserIntentParserRegExp() {
    var question_indicator = [
        'khong', 'ko', '?', 'the nao', 'tnao'
    ];

    var keyword_check_price = ['bao nhieu', 'bn', 'bao nhieu', 'gia'];
    var keyword_check_size = ['size', 'sz', 'saiz', 'co'];
    var keyword_check_color = ['mau', 'color'];

    var keyword_check_availability = [
        'con khong', 'co khong', 'co hang khong',
        'con ko', 'co ko', 'co hang ko',
        'con k0', 'co k0', 'co hang k0'
    ];
    var keyword_check_ship = ['ship', 've', 'den', 've den', 'tu'];
    var keyword_ask_pitch = ['do size', 'gia ship'];
    var keyword_ask_material = ['do size', 'gia ship', 'dia chi'];
    var keyword_ask_discount = ['sale off', 'sale-off',
        'giam gia', 'khuyen mai', 'chiet khau'
    ];

    var typeRegexp = ['nam', 'nu',
        'combo', 'cb', 'doi'
    ];

    var quantityRegexp = [
        "\\d+ doi", "\\d+ cap",
        "doi nay", "cap nay",
    ];

    var sizeRegexp = [
        "size \\d+", "sz \\d+",
        "saiz \\d+", "co \\d+"
    ];

    var colorRegexp = [
        "mau \\w+ \\w+", "mau \\w+",
        "color \\w+ \\w+", "color \\w+"
    ];

    this.isCheckQuestion = function(userMsg, keywords) {
        var result = false
        for (var i = 0; i < keywords.length; i++) {
            var index = userMsg.indexOf(keywords[i])
            if (index >= 0) {
                result = true
                break
            }
        }
        return result
    }

    this.parsePriceInfo = function(userMsg, codePattern) {
        var isQuestion = this.isCheckQuestion(userMsg, question_indicator);
        if (isQuestion && this.isCheckQuestion(userMsg, keyword_check_price)) {
            var productCode = common.extractProductCode(userMsg, codePattern).code;
            var productType = "";
            var productQuantity = "";
            for (var i = 0, length = typeRegexp.length; i < length; i++) {
                productType = common.extractValue(userMsg, typeRegexp[i]);
                if (productType != "") {
                    break;
                }
            }

            for (var i = 0, length = quantityRegexp.length; i < length; i++) {
                productQuantity = common.extractValue(userMsg, quantityRegexp[i]);
                if (productQuantity != "") {
                    productQuantity = productQuantity.match(/\d+/g);
                    break;
                }
            }

            logger.info("Code = " + productCode);
            logger.info("Type = " + productType);
            if (productQuantity === "" && productCode != "") {
                productQuantity = "1";
            }
            logger.info("Quantity = " + productQuantity);
            return true;
        } else {
            return false;
        }
    }

    this.parseColorInfo = function(userMsg, codePattern) {
        var isQuestion = this.isCheckQuestion(userMsg, question_indicator);
        if (isQuestion && this.isCheckQuestion(userMsg, keyword_check_color)) {
            var productCode = common.extractProductCode(userMsg, codePattern).code;
            var productColor = "";
            for (var i = 0, length = colorRegexp.length; i < length; i++) {
                productColor = common.extractValue(userMsg, colorRegexp[i]);
                if (productColor != "") {
                    break;
                }
            }
            logger.info("Code = " + productCode);
            logger.info("Color = " + productColor);
            return true;
        } else {
            return false;
        }
    }

    this.parseSizeInfo = function(userMsg, codePattern) {
        var isQuestion = this.isCheckQuestion(userMsg, question_indicator);
        if (isQuestion && this.isCheckQuestion(userMsg, keyword_check_size)) {
            var productCode = common.extractProductCode(userMsg, codePattern).code;
            var productSize = "";
            for (var i = 0, length = sizeRegexp.length; i < length; i++) {
                productSize = common.extractValue(userMsg, sizeRegexp[i]);
                if (productSize != "") {
                    productSize = productSize.match(/\d+/g);
                    break;
                }
            }
            logger.info("Code = " + productCode);
            logger.info("Size = " + productSize);
            return true;
        } else {
            return false;
        }
    }

    this.parseShipInfo = function(userMsg, codePattern) {
        var isQuestion = this.isCheckQuestion(userMsg, question_indicator);
        if (isQuestion && this.isCheckQuestion(userMsg, keyword_check_ship)) {
            return true;
        }
    }
}

var method = UserIntentParserRegExp.prototype

method.parse = function(userMsg, options, callback) {
    if (this.parsePriceInfo(userMsg, options.codePattern)) {
        logger.info('Checking price for customer');
    } else if (this.parseColorInfo(userMsg, options.codePattern)) {
        logger.info('parseColorInfo for customer');
    } else if (this.parseSizeInfo(userMsg, options.codePattern)) {
        logger.info('parseSizeInfo for customer');
    } else if (this.parseShipInfo(userMsg, options.codePattern)) {
        logger.info('parseShipInfo for customer');
    } else {
        logger.info('not understand message');
    }
}

module.exports = UserIntentParserRegExp
var logger = require('../util/logger.js');
var common = require('../util/common.js');
var strSimilarityChecker = require('string-similarity');

function UserIntentParserRegExp() {
    var question_indicator = [
        'khong', 'ko', '?', 'the nao', 'tnao'
    ];

    var keyword_check_price = [
        'bao nhieu', 'ba0 nhieu', 'bao nhjeu',
        'bnhieu', 'bn',
        'gia the nao', 'the nao'
    ];

    var keyword_check_availability = [
        'san hang khong', 'co san khong',
        'san hang ko', 'co san k0',
        'san ko', 'san k0',
        'con hang khong', 'co hang khong',
        'con hang kh0ng', 'co hang kh0ng',
        'con hang ko', 'co hang ko',
        'con hang k0', 'co hang k0',
        'con khong', 'co khong',
        'con ko', 'co ko',
        'con k0', 'co k0'
    ];

    var keyword_check_size = ['size', 'sz',
        'saiz', 'co'
    ];

    var keyword_check_color = ['mau', 'color'];

    var keyword_check_ship = ['ship', 've', 'den', 've den', 'tu'];

    var keyword_ask_pitch = ['do size', 'gia ship'];
    var keyword_ask_material = ['do size', 'gia ship', 'dia chi'];
    var keyword_ask_discount = ['sale off', 'sale-off',
        'giam gia', 'khuyen mai', 'chiet khau'
    ];

    var typeRegexp = ['nam', 'nu',
        'combo', 'cb' //, 'doi'
    ];

    var quantityRegexp = [
        "\\d+ doi", "\\d+ cap",
        "doi nay", "cap nay",
    ];

    var sizeRegexp = [
        "size \\d+", "sz \\d+",
        "saiz \\d+", "co \\d+",
        "size \\d+ va \\d+",
        "sz \\d+ va \\d+",
        "saiz \\d+ va \\d+",
        "co \\d+ va \\d+",
        "size nam \\d+", "size nu \\d+"
    ];

    var colorRegexp = [
        "mau \\w+ \\w+",
        "mau \\w+",
        "mau \\w+ va \\w+",
        "mau \\w+ va \\w+ \\w+",
        "mau \\w+ \\w+ va \\w+ \\w+",
        "mau \\w+ \\w+ va \\w+",
        "color \\w+ \\w+", "color \\w+"
    ];

    this.emitter = null;

    this.isCheckQuestion = function(userMsg, keywords) {
        var result = false
            // for (var i = 0; i < keywords.length; i++) {
            //     var index = userMsg.indexOf(keywords[i])
            //     if (index >= 0) {
            //         result = true;
            //         break
            //     }
            // }
        var checkString = keywords.toString();
        var similarity = strSimilarityChecker.compareTwoStrings(userMsg, checkString);
        if (similarity >= 0.1) {
            result = true;
        }
        return result
    }

    this.parseProductType = function(userMsg) {
        var productType = [];
        for (var i = 0, length = typeRegexp.length; i < length; i++) {
            productType = common.extractValues(userMsg, typeRegexp[i]);
            if (productType.length > 0) {
                break;
            }
        }
        return productType;
    }

    this.parseAndHandlePriceIntent = function(userMsg, options) {
        var ret = false;
        var isCheckPriceQuest = this.isCheckQuestion(userMsg,
            keyword_check_price);
        if (isCheckPriceQuest) {
            var productCode = common.extractProductCode(userMsg,
                options.codePattern).code;
            var productType = this.parseProductType(userMsg);
            var productQuantity = [];

            for (var i = 0, length = quantityRegexp.length; i < length; i++) {
                productQuantity = common.extractValues(userMsg, quantityRegexp[i]);
                if (productQuantity.length > 0) {
                    for (var i = 0, length = productQuantity.length; i < length; i++) {
                        var quantity = productQuantity[i].match(/\d+/)[0];
                        productQuantity[i] = quantity;
                    }
                    break;
                }
            }

            if (productQuantity.length == 0) {
                productQuantity[0] = "1";
            }

            if (productType.length > 0) {
                for (var i = 0, length = productType.length; i < (length - 1); i++) {
                    productQuantity[i] = "1";
                }
            }

            this.emitter.emit(common.INTENT_CHECK_PRICE, {
                storeid: options.storeid,
                pageid: options.pageid,
                fbid: options.fbid,
                productid: options.productid,
                code: productCode,
                type: productType,
                quantity: productQuantity,
                msg: userMsg
            });
            ret = true;
        }
        return ret;
    }

    this.parseAndHandleColorIntent = function(userMsg, options) {
        var isCheckColorQuestion = this.isCheckQuestion(userMsg, keyword_check_color);
        if (isCheckColorQuestion) {
            var productCode = common.extractProductCode(userMsg, options.codePattern).code;
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

    this.parseAndHandleSizeInfo = function(userMsg, options) {
        var isCheckSizeQuestion = this.isCheckQuestion(userMsg, keyword_check_size);
        if (isCheckSizeQuestion) {
            var productCode = common.extractProductCode(userMsg, options.codePattern).code;
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

    this.parseAndHandleAvailabilityIntent = function(userMsg, options) {
        var ret = false;
        var isAvailableQuestion = this.isCheckQuestion(userMsg, keyword_check_availability);
        if (isAvailableQuestion) {
            if (this.parseAndHandleColorIntent(userMsg, options)) {
                logger.info('parseColorInfo for customer');
            } else if (this.parseAndHandleSizeInfo(userMsg, options)) {
                logger.info('parseSizeInfo for customer');
            }
            ret = true;
        }
        return ret;
    }

    this.parseAndHandleShipIntent = function(userMsg, codePattern) {
        var isQuestion = this.isCheckQuestion(userMsg, question_indicator);
        if (isQuestion && this.isCheckQuestion(userMsg, keyword_check_ship)) {
            return true;
        }
    }
}

var method = UserIntentParserRegExp.prototype;
method.setEmitter = function(emitter) {
    this.emitter = emitter;
}

method.parse = function(userMsg, options) {
    if (this.parseAndHandlePriceIntent(userMsg, options)) {
        logger.info('parsePriceInfo for customer');
    } else if (this.parseAndHandleAvailabilityIntent(userMsg, options)) {
        logger.info('parseAndHandleAvailabilityIntent for customer');
    } else if (this.parseAndHandleShipIntent(userMsg, options)) {
        logger.info('parseShipInfo for customer');
    } else {
        logger.info('not parse message ==> will apply search approach');
        this.emitter.emit(common.INTENT_GENERAL_SEARCH, {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            msg: userMsg
        });
    }
}

module.exports = UserIntentParserRegExp
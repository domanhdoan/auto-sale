var logger = require('../util/logger.js');
var common = require('../util/common.js');
var strSimilarityChecker = require('string-similarity');
var nlpChecker = require('natural');

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
        "size nam \\d+", "size nu \\d+",
        "size", "co", "saiz", "sz",
    ];

    var colorRegexp = [
        "mau \\w+ \\w+",
        "mau \\w+",
        "mau \\w+ va \\w+",
        "mau \\w+ va \\w+ \\w+",
        "mau \\w+ \\w+ va \\w+ \\w+",
        "mau \\w+ \\w+ va \\w+",
        "color \\w+ \\w+", "color \\w+",
        "mau"
    ];

    this.emitter = null;

    var intentClassifier = new nlpChecker.BayesClassifier();

    this.initClassifier = function(classifier, dataSet, intent) {
        for (var i = 0; i < dataSet.length; i++) {
            classifier.addDocument(dataSet[i], intent);
        }
        classifier.train();
    }

    this.trainPriceClassifier = function() {
        this.initClassifier(intentClassifier, keyword_check_price, common.INTENT_CHECK_PRICE);
    }

    this.trainAvailabilityClassifier = function() {
        this.initClassifier(intentClassifier, keyword_check_availability, common.INTENT_CHECK_AVAILABILITY);
    }

    this.trainShipClassifier = function() {
        this.initClassifier(intentClassifier, this.keyword_check_ship, common.INTENT_CHECK_SHIP);
    }

    this.getIntent = function(message) {
        return intentClassifier.classify(message);
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

    this.parsePriceIntentInfo = function(userMsg, options) {
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
    }

    this.parseColorInfo = function(userMsg) {
        var productColor = "";
        for (var i = 0, length = colorRegexp.length; i < length; i++) {
            productColor = common.extractValue(userMsg, colorRegexp[i]);
            if (productColor != "") {
                break;
            }
        }
        return productColor;
    }

    this.parseSizeInfo = function(userMsg) {
        var productSize = "";
        for (var i = 0, length = sizeRegexp.length; i < length; i++) {
            productSize = common.extractValue(userMsg, sizeRegexp[i]);
            if (productSize != "") {
                productSize = productSize.match(/\d+/g);
                break;
            }
        }
        return productSize;
    }

    this.parseAvailabilityIntentInfo = function(userMsg, options) {
        var productCode = common.extractProductCode(userMsg, options.codePattern).code;
        var color = this.parseColorInfo(userMsg);
        var size = this.parseSizeInfo(userMsg);
        this.emitter.emit(common.INTENT_CHECK_PRICE, {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            color: color,
            size: size,
            msg: userMsg
        });
    }

    this.parseShipIntentInfo = function(userMsg, codePattern) {}
}

var method = UserIntentParserRegExp.prototype;
method.setEmitter = function(emitter) {
    this.emitter = emitter;

    this.trainPriceClassifier();
    this.trainAvailabilityClassifier();
}

method.parse = function(userMsg, options) {
    var intent = this.getIntent(userMsg);
    if (intent === common.INTENT_CHECK_PRICE) {
        logger.info('parsePriceInfo for customer');
        this.parsePriceIntentInfo(userMsg, options);
    } else if (intent === common.INTENT_CHECK_AVAILABILITY) {
        logger.info('parseAvailabilityIntentData for customer');
        this.parseAvailabilityIntentInfo(userMsg, options);
    } else if (intent === common.INTENT_CHECK_SHIP) {
        logger.info('parseShipInfo for customer');
        this.parseShipIntentInfo(userMsg, options);
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
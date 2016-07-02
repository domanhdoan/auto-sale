var logger = require('../util/logger.js');
var common = require('../util/common.js');
var strSimilarityChecker = require('string-similarity');
var nlpChecker = require('natural');

function UserIntentParserRegExp() {

    var keyword_type = [
        "nam", "nu", "combo", "cb"
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
        'con du', 'co den', "co nhung",
        "saiz nao", "size nao", "sz nao", "co nao", "mau nao"
    ];

    var keyword_check_ship = ['ship', 've',
        'den', 've den', 'tu',
        'free ship', "COD", "gia ship",
        "bao lau", " het bao nhieu"
    ];

    var keyword_ask_consult = ['do size', 'gia ship'];
    var keyword_ask_location = ['dia chi'];

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
        "size \\d+ \\w+ size \\d+",
        "size \\d+ \\w+ \\d+",
        "size \\d+ \\d+",
        "size \\d+-\\d+",
        "size \\d+ - \\d+",
        "size \\w+ \\d+ \\w+ \\d+",
        "size \\d+",
        "size nam \\d+", "size nu \\d+",
        "size"
    ];

    this.emitter = null;

    var intentClassifier = new nlpChecker.BayesClassifier();
    var propertiesClassifier = new nlpChecker.LogisticRegressionClassifier();

    this.initClassifier = function(classifier, dataSet, intent) {
        for (var i = 0; i < dataSet.length; i++) {
            classifier.addDocument(dataSet[i], intent);
        }
        classifier.train();
    }

    this.trainColorClassifier = function() {
        var colorsVn = common.getAllcolorVn();
        var keys = Object.keys(colorsVn);
        for (var i = 0, length = keys.length; i < length; i++) {
            var color_invn = colorsVn[keys[i]].latinise();
            propertiesClassifier.addDocument(color_invn, color_invn);
        }
        propertiesClassifier.addDocument("mau", color_invn);
        propertiesClassifier.train();
    }

    this.trainPriceClassifier = function() {
        this.initClassifier(intentClassifier, keyword_check_price, common.INTENT_CHECK_PRICE);
    }

    this.trainAvailabilityClassifier = function() {
        this.initClassifier(intentClassifier, keyword_check_availability, common.INTENT_CHECK_AVAILABILITY);
    }

    this.trainShipClassifier = function() {
        this.initClassifier(intentClassifier, keyword_check_ship, common.INTENT_CHECK_SHIP);
    }

    this.getIntent = function(message) {
        var classifications = intentClassifier.getClassifications(message);
        // logger.info("message = " + message);
        // logger.info("Classification = " + JSON.stringify(classifications));
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

        this.emitter.emit(common.INTENT_CHECK_AVAILABILITY, {
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
        var productColor = [];
        var classifications = propertiesClassifier.getClassifications(userMsg);
        logger.info("User message: " + userMsg);
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i];
            if (classifications[i].value > 0.9) {
                logger.info("High probility = " + JSON.stringify(classification));
                productColor.push(classification.label.toLowerCase());
            } else {
                logger.info("Low probility = " + JSON.stringify(classification));
            }
        }
        return productColor;
    }

    this.parseSizeInfo = function(userMsg) {
        var productSizes = [];
        userMsg = userMsg.replaceAll("saiz", "size");
        userMsg = userMsg.replaceAll("sz", "size");
        userMsg = userMsg.replaceAll("co", "size");
        for (var i = 0, length = sizeRegexp.length; i < length; i++) {
            productSizes = common.extractValue(userMsg, sizeRegexp[i]);
            if (productSizes != "") {
                productSizes = common.extractValues(productSizes, "\\d+");
                if (productSizes.length === 0) {
                    productSizes.push("all");
                }
                break;
            }
        }
        return productSizes;
    }

    this.parseAvailabilityIntentInfo = function(userMsg, options) {
        var productCode = common.extractProductCode(userMsg, options.codePattern).code;
        var color = this.parseColorInfo(userMsg);
        var size = this.parseSizeInfo(userMsg);
        this.emitter.emit(common.INTENT_CHECK_AVAILABILITY, {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            code: productCode,
            color: color,
            size: size,
            msg: userMsg
        });
    }

    this.parseShipIntentInfo = function(userMsg, options) {
        this.emitter.emit(common.INTENT_CHECK_SHIP, {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            msg: userMsg
        });
    }
}

var method = UserIntentParserRegExp.prototype;
method.setEmitter = function(emitter) {
    this.emitter = emitter;

    this.trainPriceClassifier();
    this.trainAvailabilityClassifier();
    this.trainShipClassifier();
    this.trainColorClassifier();
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
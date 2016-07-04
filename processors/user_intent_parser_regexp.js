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
        'gia the nao', 'thi the nao'
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

    var keyword_check_ship = [
        'ship', 've', 'tu',
        'giao hang',
        'free ship', "COD", "gia ship",
        "bao lau", "het bao nhieu"
    ];

    var keyword_category = [
        "the thao", "the thao doi", "the thao nam", "the thao nu",
        "adidas", "nike", "ked", "slip on", "oxford", "bet", "bup be"
    ];
    var keyword_ask_consult = ['do size', 'gia ship'];
    var keyword_ask_location = ['dia chi'];

    var keyword_ask_discount = ['sale off', 'sale-off',
        'giam gia', 'khuyen mai', 'chiet khau'
    ];

    var typeRegexp = ['nam', 'nu',
        'combo', 'cb'
    ];

    var quantityRegexp = [
        "\\d+ doi", "\\d+ cap",
        "doi nay", "cap nay",
    ];

    var sizeRegexp = [
        "co \\d+ \\w+ co \\d+",
        "co \\d+ \\w+ \\d+",
        "co \\d+ \\d+",
        "co \\d+ - \\d+",
        "co \\d+-\\d+",
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
    var categoryClassifier = new nlpChecker.LogisticRegressionClassifier();

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

    this.trainCatergoryClassifier = function() {
        this.initClassifier(categoryClassifier, keyword_category, common.INTENT_GENERAL_SEARCH);
    }

    this.getIntent = function(message) {
        var classifications = intentClassifier.getClassifications(message);
        var intent = common.INTENT_UNKNOWN;
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i];
            if (classifications[i].value > common.INTENT_ACCURACY) {
                logger.info("High probility = " + JSON.stringify(classification));
                intent = classification.label;
                break;
            } else {
                logger.info("Low probility = " + JSON.stringify(classification));
            }
        }
        return intent;
    }

    this.parseProductType = function(userMsg) {
        var productType = [];
        for (var i = 0, length = typeRegexp.length; i < length; i++) {
            var type = common.extractValues(userMsg, typeRegexp[i]);
            if (type != "") {
                productType.push(type);
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
            var quantities = common.extractValues(userMsg, quantityRegexp[i]);
            if (quantities.length > 0) {
                for (var j = 0, length = quantities.length; j < length; j++) {
                    var quantity = common.extractValue(quantities[j], "\\d+");
                    if (quantity === "") {
                        productQuantity.push("1");
                    } else {
                        productQuantity.push(quantity);
                    }
                }
                break;
            }
        }

        if (productType.length > 0) {
            for (var i = 0, length = productType.length; i < (length - 1); i++) {
                productQuantity[i] = "1";
            }
        } else {
            productQuantity[0] = "1";
        }
        var data = {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            code: productCode,
            type: productType,
            quantity: productQuantity,
            msg: userMsg
        };
        logger.info("[Check Price] Data sent from intent parser to sale bot" + JSON.stringify(data));
        this.emitter.emit(common.INTENT_CHECK_PRICE, data);
    }


    this.parseColorInfo = function(userMsg) {
        var productColor = [];
        var classifications = propertiesClassifier.getClassifications(userMsg);
        logger.info("User message: " + userMsg);
        if (userMsg.indexOf("mau") >= 0) {
            // for (var i = 0, length = classifications.length; i < length; i++) {
            //     var classification = classifications[i];
            //     if (classifications[i].value > 0.9) {
            //         logger.info("High probility = " + JSON.stringify(classification));
            //         //productColor.push(classification.label.toLowerCase());
            //     } else {
            //         logger.info("Low probility = " + JSON.stringify(classification));
            //     }
            // }
            productColor.push(propertiesClassifier.classify(userMsg));
        }
        return productColor;
    }

    this.parseSizeInfo = function(userMsg) {
        var productSizes = [];
        userMsg = userMsg.replaceAll("saiz", "size");
        userMsg = userMsg.replaceAll("sz", "size");
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
        if (productSizes === "") {
            productSizes = [];
        }
        return productSizes;
    }

    this.parseAvailabilityIntentInfo = function(userMsg, options) {
        var categorySearch = categoryClassifier.classify(userMsg);
        var classifications = categoryClassifier.getClassifications(userMsg);
        var classification = classifications[0];

        var data = {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            msg: userMsg
        };

        var size = this.parseSizeInfo(userMsg);
        var color = this.parseColorInfo(userMsg);
        var productCode = common.extractProductCode(userMsg, options.codePattern).code;

        // Decide really user intent from 2 factors (question type and information extracted)
        // Pass 1: decide by weather question contain a category or not
        var trueIntent = (classification.value >= 0.8) ? categorySearch : common.INTENT_CHECK_AVAILABILITY;
        // Weather user type size or color information or not
        if (productCode != "" && (size.length * color == 0)) {
            trueIntent = common.INTENT_GENERAL_SEARCH;
        }

        if (trueIntent != common.INTENT_GENERAL_SEARCH) {
            data.code = productCode;
            data.color = color;
            data.size = size;
        }

        logger.info("[Check Avai] Data sent from intent parser to sale bot" + JSON.stringify(data));
        this.emitter.emit(trueIntent, data);
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
    this.trainCatergoryClassifier();
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
        logger.info('not parse message ==> will call staff for support');
        // this.emitter.emit(common.INTENT_GENERAL_SEARCH, {
        //     storeid: options.storeid,
        //     pageid: options.pageid,
        //     fbid: options.fbid,
        //     msg: userMsg
        // });
    }
}

module.exports = UserIntentParserRegExp
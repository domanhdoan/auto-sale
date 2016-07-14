var logger = require('../util/logger.js')
var common = require('../util/common.js')
var strSimilarityChecker = require('string-similarity')
var nlpChecker = require('natural')

function UserIntentParserNLP() {
    var keyword_category = [
        'the thao', 'the thao doi', 'the thao nam', 'the thao nu',
        'adidas', 'nike', 'ked', 'slip on', 'oxford', 'bet', 'bup be'
    ]
    var keyword_ask_consult = ['do size', 'gia ship']
    var keyword_ask_location = ['dia chi']

    var keyword_ask_discount = ['sale off', 'sale-off',
        'giam gia', 'khuyen mai', 'chiet khau'
    ]

    var typeRegexp = ['nam', 'nu',
        'combo', 'cb'
    ]

    var quantityRegexp = [
        '\\d+ doi', '\\d+ cap',
        'doi nay', 'cap nay',
    ]

    var sizeRegexp = [
        'co \\d+ \\w+ co \\d+',
        'co \\d+ \\w+ \\d+',
        'co \\d+ \\d+',
        'co \\d+ - \\d+',
        'co \\d+-\\d+',
        'size \\d+ \\w+ size \\d+',
        'size \\d+ \\w+ \\d+',
        'size \\d+ \\d+',
        'size \\d+-\\d+',
        'size \\d+ - \\d+',
        'size \\w+ \\d+ \\w+ \\d+',
        'size \\d+',
        'size nam \\d+', 'size nu \\d+',
        'nam size \\d+', 'nu size \\d+',
        'size'
    ]
    this.emitter = null

    var intentTrainingData = common.loadJson('./datasets/nlp/intent.json')
    var locationTrainingData = common.loadJson('./datasets/nlp/location.json')
    var shipTrainingData = common.loadJson('./datasets/nlp/ship.json')

    var questionClassifier = new nlpChecker.LogisticRegressionClassifier()

    var shipClassifier = new nlpChecker.LogisticRegressionClassifier()
    var locationClassifier = new nlpChecker.BayesClassifier()
    var propertiesClassifier = new nlpChecker.LogisticRegressionClassifier()
    var categoryClassifier = new nlpChecker.LogisticRegressionClassifier()

    this.initClassifier = function(classifier, dataSet, intent) {
        for (var i = 0; i < dataSet.length; i++) {
            classifier.addDocument(dataSet[i], intent)
        }
        classifier.train()
    }

    this.trainColorClassifier = function() {
        var colorsVn = common.getAllcolorVn();
        var keys = Object.keys(colorsVn);
        for (var i = 0, length = keys.length; i < length; i++) {
            var color_invn = colorsVn[keys[i]].latinise();
            propertiesClassifier.addDocument(color_invn, color_invn);
        }
        propertiesClassifier.train();
    }

    this.trainPriceClassifier = function() {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_PRICE], common.INTENT_CHECK_PRICE)
    }

    this.trainAvailabilityClassifier = function() {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_AVAILABILITY], common.INTENT_CHECK_AVAILABILITY)
    }

    this.trainShipClassifier = function() {
        var keys = shipTrainingData.ship;
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            this.initClassifier(shipClassifier, key.value, key.name);
        }
    }

    this.trainCatergoryClassifier = function() {
        for (var i = 0, length = keyword_category.length; i < length; i++) {
            var key = keyword_category[i];
            categoryClassifier.addDocument(key, key);
        }
        categoryClassifier.train();
    }

    this.trainLocationClassifier = function() {
        var keys = locationTrainingData.province;
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            this.initClassifier(locationClassifier, key.value, key.name);
        }
    }

    this.isShipIntent = function(message) {
        var ret = false;
        var intents = [];
        var classifications = shipClassifier.getClassifications(message)
        for (var i = 0, length = classifications.length; i < length; i++) {
            if (classifications[i].value > common.INTENT_ACCURACY) {
                ret = true;
                break;
            }
        }
        return ret;
    }

    this.getIntent = function(message) {
        var intents = [];
        var classifications = questionClassifier.getClassifications(message)
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i]
            if (classifications[i].value > common.INTENT_ACCURACY) {
                logger.info('High probility = ' + JSON.stringify(classification))
                if (classification.label === common.INTENT_CHECK_AVAILABILITY) {
                    if (this.isShipIntent(message)) {
                        intents.push(common.INTENT_CHECK_SHIP);
                    } else {
                        intents.push(classification.label)
                    }
                } else {
                    intents.push(classification.label)
                }

            } else {
                logger.info('Low probility = ' + JSON.stringify(classification))
                break;
            }
        }
        if (intents.length == 0) {
            intents.push(common.INTENT_UNKNOWN);
        }
        return intents
    }

    this.parseProductType = function(userMsg) {
        var productType = []
        for (var i = 0, length = typeRegexp.length; i < length; i++) {
            var type = common.extractValues(userMsg, typeRegexp[i])
            if (type != '') {
                productType.push(type)
            }
        }
        return productType
    }

    this.parseColorInfo = function(userMsg) {
        var productColor = []
        var classifications = propertiesClassifier.getClassifications(userMsg)
        logger.info('User message: ' + userMsg)
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i]
            if (classifications[i].value > common.INTENT_ACCURACY) {
                logger.info('High probility = ' + JSON.stringify(classification))
                productColor.push(classification.label.toLowerCase())
            } else {
                logger.info('Low probility = ' + JSON.stringify(classification))
                break;
            }
        }
        return productColor;
    }

    this.parseSizeInfo = function(userMsg) {
        var productSizes = []
        userMsg = userMsg.replaceAll('saiz', 'size');
        userMsg = userMsg.replaceAll('sai', 'size');
        userMsg = userMsg.replaceAll('sz', 'size');
        for (var i = 0, length = sizeRegexp.length; i < length; i++) {
            productSizes = common.extractValue(userMsg, sizeRegexp[i])
            if (productSizes != '') {
                productSizes = common.extractValues(productSizes, '\\d+')
                if (productSizes.length === 0) {
                    productSizes.push('all');
                }
                break
            }
        }
        if (productSizes === '') {
            productSizes = [];
        }
        return productSizes;
    }

    this.parseQuantity = function(userMsg) {
        var productQuantity = []

        for (var i = 0, length = quantityRegexp.length; i < length; i++) {
            var quantities = common.extractValues(userMsg, quantityRegexp[i])
            if (quantities.length > 0) {
                for (var j = 0, length = quantities.length; j < length; j++) {
                    var quantity = common.extractValue(quantities[j], '\\d+')
                    if (quantity === '') {
                        productQuantity.push('1');
                    } else {
                        productQuantity.push(quantity);
                    }
                }
                break
            }
        }
        return productQuantity;
    }
    this.parsePriceIntent = function(userMsg, options) {
        var productCode = common.extractProductCode(userMsg,
            options.codePattern).code
        var productType = this.parseProductType(userMsg)
        var productQuantity = this.parseQuantity(userMsg);

        if (productType.length > 0) {
            for (var i = 0, length = productType.length; i < (length - 1); i++) {
                productQuantity[i] = '1';
            }
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
        }
        logger.info('[Check Price] Data sent from intent parser to sale bot' + JSON.stringify(data))
        this.emitter.emit(common.INTENT_CHECK_PRICE, data)
    }

    this.parseAvailabilityIntent = function(userMsg, options) {

        var data = {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            msg: userMsg
        }

        var size = this.parseSizeInfo(userMsg)
        var color = this.parseColorInfo(userMsg)
        var productCode = common.extractProductCode(userMsg, options.codePattern).code

        // Decide really user intent from 2 factors (question type and information extracted)
        // Pass 1: decide by weather question contain a category or not
        if (productCode != '') {
            data.category = productCode;
        } else {
            var categorySearch = categoryClassifier.classify(userMsg);
            var classifications = categoryClassifier.getClassifications(userMsg);
            var classification = classifications[0];
            var productQuantity = this.parseQuantity(userMsg);
            if (classifications[0].value > common.INTENT_ACCURACY && productQuantity.length === 0) {
                data.category = classifications[0].label;
            } else {
                data.category = userMsg;
            }
        }

        data.code = productCode;
        data.color = color;
        data.size = size;

        logger.info('[Check Avai] Data sent from intent parser to sale bot' + JSON.stringify(data))
        this.emitter.emit(common.INTENT_CHECK_AVAILABILITY, data);
    }

    this.parseShipIntent = function(userMsg, options) {
        var location = locationClassifier.classify(userMsg)
        this.emitter.emit(common.INTENT_CHECK_SHIP, {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            msg: userMsg,
            location: location
        })
    }

    this.trainPriceClassifier();
    this.trainAvailabilityClassifier();
    this.trainShipClassifier();
    this.trainColorClassifier();
    this.trainCatergoryClassifier();
    this.trainLocationClassifier();
}

var method = UserIntentParserNLP.prototype
method.setEmitter = function(emitter) {
    this.emitter = emitter
}

method.parse = function(userMsg, options) {
    var intents = this.getIntent(userMsg)
    for (var i = 0; i < intents.length; i++) {
        var intent = intents[i];
        if (intent === common.INTENT_CHECK_PRICE) {
            logger.info('parsePriceInfo for customer')
            this.parsePriceIntent(userMsg, options)
        } else if (intent === common.INTENT_CHECK_AVAILABILITY) {
            logger.info('parseAvailabilityIntentData for customer')
            this.parseAvailabilityIntent(userMsg, options)
        } else if (intent === common.INTENT_CHECK_SHIP) {
            logger.info('parseShipInfo for customer')
            this.parseShipIntent(userMsg, options)
        } else {
            logger.info('not parse message ' + userMsg + ' ==> will call staff for support')
            this.emitter.emit(common.INTENT_GENERAL_SEARCH, {
                storeid: options.storeid,
                pageid: options.pageid,
                fbid: options.fbid,
                msg: userMsg
            })
        }
    }

}

module.exports = UserIntentParserNLP
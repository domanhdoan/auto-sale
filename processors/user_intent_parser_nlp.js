var logger = require('../util/logger.js')
var common = require('../util/common.js')
var nlpChecker = require('natural')

function UserIntentParserNLP() {

    this.emitter = null

    var intentTrainingData = common.loadJson('./datasets/nlp/intent.json');
    var locationTrainingData = common.loadJson('./datasets/nlp/location.json');
    var categoryTrainingData = common.loadJson('./datasets/nlp/category.json');
    var shipTrainingData = common.loadJson('./datasets/nlp/ship.json');
    var regExpData = common.loadJson('./datasets/nlp/regexp.json');

    var typeRegexp = regExpData.typeRegexp;
    var quantityRegexp = regExpData.quantityRegexp;
    var sizeRegexp = regExpData.sizeRegexp;
    var keyword_category = categoryTrainingData.category;

    var questionClassifier = new nlpChecker.LogisticRegressionClassifier();
    var shipClassifier = new nlpChecker.BayesClassifier();
    var locationClassifier = new nlpChecker.LogisticRegressionClassifier();
    var propertiesClassifier = new nlpChecker.LogisticRegressionClassifier();
    var categoryClassifier = new nlpChecker.LogisticRegressionClassifier();

    this.initClassifier = function (classifier, dataSet, intent) {
        for (var i = 0; i < dataSet.length; i++) {
            classifier.addDocument(dataSet[i], intent)
        }
        classifier.train()
    }

    this.trainColorClassifier = function () {
        var colorsVn = common.getAllcolorVn();
        var keys = Object.keys(colorsVn);
        for (var i = 0, length = keys.length; i < length; i++) {
            var color_invn = colorsVn[keys[i]].latinise();
            propertiesClassifier.addDocument(color_invn, color_invn);
        }
        propertiesClassifier.train();
    }

    this.trainPriceClassifier = function () {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_PRICE], common.INTENT_CHECK_PRICE);
    }

    this.trainAvailabilityClassifier = function () {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_AVAILABILITY], common.INTENT_CHECK_AVAILABILITY);
    }

    this.trainShipClassifier = function () {
        var keys = shipTrainingData.ship;
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            this.initClassifier(shipClassifier, key.value, key.name);
        }
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_PRICE], common.INTENT_CHECK_SHIP);
    }

    this.trainCatergoryClassifier = function () {
        for (var i = 0, length = keyword_category.length; i < length; i++) {
            var key = keyword_category[i];
            categoryClassifier.addDocument(key, key);
        }
        categoryClassifier.train();
    }

    this.trainLocationClassifier = function () {
        var keys = locationTrainingData.province;
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            this.initClassifier(locationClassifier, key.value, key.name);
        }
    }

    this.isShipIntent = function (message) {
        var ret = false;
        var intent = this.parseInfoWithAccuracy(shipClassifier, message, common.INTENT_ACCURACY_LOW / 2);
        if (intent != "") {
            ret = true;
        }
        return ret;
    }

    this.getIntent = function (message) {
        var intents = [];
        var classifications = questionClassifier.getClassifications(message)
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i]
            if (classifications[i].value > common.INTENT_ACCURACY_LOW) {
                logger.info('High probility = ' + JSON.stringify(classification))
                if (this.isShipIntent(message)) {
                    var index = intents.indexOf(common.INTENT_CHECK_SHIP);
                    if (index < 0) {
                        intents.push(common.INTENT_CHECK_SHIP);
                    } else {
                        logger.info("Not add ship intent");
                    }
                } else {
                    intents.push(classification.label);
                }
            } else {
                logger.info('Low probility = ' + JSON.stringify(classification))
                break;
            }
        }
        if (intents.length == 0) {
            intents.push(common.INTENT_UNKNOWN);
        }
        return intents;
    }

    this.parseProductType = function (userMsg) {
        var productType = []
        for (var i = 0, length = typeRegexp.length; i < length; i++) {
            var type = common.extractValues(userMsg, typeRegexp[i]);
            if (type != '') {
                productType.push(type);
            }
        }
        return productType;
    }

    this.removeClassiferFeatures = function (classifier, userMsg) {
        var wordList = Object.keys(classifier.features);
        for (var i = 0, length = wordList.length; i < length; i++) {
            userMsg = userMsg.replace(wordList[i], "");
        }
        return userMsg;
    }

    this.parseColorInfo = function (userMsg) {
        var productColor = []
        var classifications = propertiesClassifier.getClassifications(userMsg)
        logger.info('User message: ' + userMsg);
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i];
            if (classifications[i].value > common.INTENT_ACCURACY) {
                logger.info('High probility = ' + JSON.stringify(classification));
                productColor.push(classification.label.toLowerCase());
            } else {
                logger.info('Low probility = ' + JSON.stringify(classification));
                break;
            }
        }
        return productColor;
    }

    this.parseSizeInfo = function (userMsg) {
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

    this.parseQuantity = function (userMsg) {
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

    this.parseCategory = function (userMsg, quantityCount) {
        var category = this.parseInfoWithAccuracy(categoryClassifier, userMsg, common.INTENT_ACCURACY);
        if (quantityCount > 0) {
            category = "";
        }
        return category;
    }

    this.parsePriceIntent = function (userMsg, options) {
        var productCode = common.extractProductCode(userMsg,
            options.codePattern).code
        var productTypes = this.parseProductType(userMsg)
        var productQuantity = this.parseQuantity(userMsg);

        if (productTypes.length > 0) {
            for (var i = 0, length = productTypes.length; i < length; i++) {
                productQuantity[i] = '1';
            }
        }
        var data = {
            intent: common.INTENT_CHECK_PRICE,
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            code: productCode,
            type: productTypes,
            quantity: productQuantity,
            msg: userMsg
        };
        logger.info('[Check Price] Data sent from intent parser to sale bot' + JSON.stringify(data))
        return data;
    }

    this.parseAvailabilityIntent = function (userMsg, options) {

        var data = {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            msg: userMsg
        }
        userMsg = this.removeClassiferFeatures(questionClassifier, userMsg);
        var size = this.parseSizeInfo(userMsg)
        var color = this.parseColorInfo(userMsg)
        var productCode = common.extractProductCode(userMsg, options.codePattern).code

        // Decide really user intent from 2 factors (question type and information extracted)
        // Pass 1: decide by weather question contain a category or not
        if (productCode != '') {
            data.category = productCode;
        } else {
            var productQuantity = this.parseQuantity(userMsg);
            var category = this.parseCategory(userMsg, productQuantity.length);
            data.category = category;
        }

        data.code = productCode;
        data.color = color;
        data.size = size;
        data.intent = common.INTENT_CHECK_AVAILABILITY;
        logger.info('[Check Avai] Data sent from intent parser to sale bot' + JSON.stringify(data));
        return data;
    }

    this.parseInfoWithAccuracy = function (classifier, userMsg, accuracy) {
        var info = "";
        var classifications = classifier.getClassifications(userMsg);
        if (classifications.length > 0) {
            var classification = classifications[0];
            if (classification.value >= accuracy) {
                info = classification.label;
            }
        }
        return info;
    }

    this.parseShipIntent = function (userMsg, options) {
        var location = this.parseInfoWithAccuracy(locationClassifier, userMsg, common.INTENT_ACCURACY);
        var shipIntent = this.parseInfoWithAccuracy(shipClassifier, userMsg, common.INTENT_ACCURACY_LOW);

        var data = {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            msg: userMsg,
            location: location,
            intent: shipIntent
        };
        data.intent = common.INTENT_CHECK_SHIP;
        return data;
    }

    this.trainPriceClassifier();
    this.trainAvailabilityClassifier();
    this.trainShipClassifier();
    this.trainColorClassifier();
    this.trainCatergoryClassifier();
    this.trainLocationClassifier();
}

var method = UserIntentParserNLP.prototype;
method.setEmitter = function (emitter) {
    this.emitter = emitter;
}

method.parse = function (userMsg, options) {
    logger.info("Parsing: " + userMsg);
    var intents = this.getIntent(userMsg);
    var data = null;
    for (var i = 0; i < intents.length; i++) {
        var intent = intents[i];
        if (intent === common.INTENT_CHECK_PRICE) {
            logger.info('parsePriceInfo for customer')
            data = this.parsePriceIntent(userMsg, options);
        } else if (intent === common.INTENT_CHECK_AVAILABILITY) {
            logger.info('parseAvailabilityIntentData for customer')
            data = this.parseAvailabilityIntent(userMsg, options);
        } else if (intent === common.INTENT_CHECK_SHIP) {
            logger.info('parseShipInfo for customer')
            data = this.parseShipIntent(userMsg, options);
        } else {
            data = this.parseAvailabilityIntent(userMsg, options);
            if ((data.category === "") && (data.color.length === 0) && (data.size.length === 0)) {
                logger.info('not parse message ' + userMsg + ' ==> will call staff for support')
                data.intent = common.INTENT_UNKNOWN;
            }
        }
        this.emitter.emit(data.intent, data);
        common.saveToFile("nlp_log.txt", "\n" + JSON.stringify(data));
    }
}

module.exports = UserIntentParserNLP;

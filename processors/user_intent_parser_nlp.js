var logger = require('../util/logger.js')
var common = require('../util/common.js')
var nlpChecker = require('natural')
var gProductFinder = require('../dal/product_finder.js');

function UserIntentParserNLP() {
    this.emitter = null

    var intentTrainingData = common.loadJson('./datasets/nlp/intent.json')
    var locationTrainingData = common.loadJson('./datasets/nlp/location.json')
    var categoryTrainingData = common.loadJson('./datasets/nlp/category.json')
    var shipTrainingData = common.loadJson('./datasets/nlp/ship.json')
    var regExpData = common.loadJson('./datasets/nlp/regexp.json')
    this.unprocessWordList = common.loadJson('./datasets/nlp/notprocess.json').unprocess

    var typeRegexp = regExpData.typeRegexp
    var quantityRegexp = regExpData.quantityRegexp
    var sizeRegexp = regExpData.sizeRegexp
    var keyword_category = categoryTrainingData.category

    var questionClassifier = new nlpChecker.LogisticRegressionClassifier()
    var shipClassifier = new nlpChecker.LogisticRegressionClassifier()
    var locationClassifier = new nlpChecker.LogisticRegressionClassifier()
    var propertiesClassifier = new nlpChecker.LogisticRegressionClassifier()
    var categoryClassifier = new nlpChecker.LogisticRegressionClassifier()
    
    // Array is to define classifers for extracting properties
    var propertyClassifiers = [];
    
    this.initClassifier = function (classifier, dataSet, intent) {
        for (var i = 0; i < dataSet.length; i++) {
            classifier.addDocument(dataSet[i], intent);
        }
        classifier.train()
    }

    this.trainColorClassifier = function () {
        var colorsVn = common.getAllcolorVn()
        var keys = Object.keys(colorsVn)
        for (var i = 0, length = keys.length; i < length; i++) {
            var color_invn = colorsVn[keys[i]].latinise().toLowerCase()
            propertiesClassifier.addDocument(color_invn, color_invn)
        }
        propertiesClassifier.train()
    }

    this.trainPriceClassifier = function () {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_PRICE], common.INTENT_CHECK_PRICE)
    }

    this.trainAvailabilityClassifier = function () {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_AVAILABILITY], common.INTENT_CHECK_AVAILABILITY)
    }

    this.trainShipClassifier = function () {
        var keys = shipTrainingData.ship
            for (var i = 0, length = keys.length; i < length; i++) {
                var key = keys[i];
                this.initClassifier(shipClassifier, key.value, key.name);
            }
            this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_SHIP], common.INTENT_CHECK_SHIP);
    }

    
    this.trainOtherClassifier = function () {
        this.initClassifier(questionClassifier,
            intentTrainingData[common.INTENT_CHECK_SALEOFF], common.INTENT_CHECK_SALEOFF)
    }
    
    this.trainCatergoryClassifier = function () {
        for (var i = 0, length = keyword_category.length; i < length; i++) {
            var key = keyword_category[i];
            categoryClassifier.addDocument(key, key);
        }
        categoryClassifier.train();
    }

    this.trainLocationClassifier = function () {
        var keys = locationTrainingData.province
            for (var i = 0, length = keys.length; i < length; i++) {
                var key = keys[i];
                this.initClassifier(locationClassifier, key.value, key.name)
            }
    }
    
    this.loadTrainingDataFromDB = function(){
        gProductFinder.getAllProperties(function(properties){
            properties.forEach(function (property) {
                if(property.name === "color"){
                    propertiesClassifier.addDocument(property.svalue, property.svalue);
                    propertiesClassifier.addDocument(property.svalue.toLowerCase(), property.svalue);
                    propertiesClassifier.addDocument(property.svalue.latinise(), property.svalue);
                    propertiesClassifier.addDocument(property.svalue.latinise().toLowerCase(), property.svalue);
                }else if(property.name === "size"){
                    
                }else if(property.name === "material"){
                    
                }else if((property.name === "brand") || (property.name === "shape")){
                    categoryClassifier.addDocument(property.svalue, property.svalue);
                    categoryClassifier.addDocument(property.svalue.toLowerCase(), property.svalue);
                    categoryClassifier.addDocument(property.svalue.latinise(), property.svalue);
                    categoryClassifier.addDocument(property.svalue.latinise().toLowerCase(), property.svalue);
                }else{
                    
                }
            });
            propertiesClassifier.train();
            categoryClassifier.train();
        });
    }
    
    this.isShipIntent = function (message) {
        var ret = false
            var intent = this.parseInfoWithAccuracy(shipClassifier, message, common.INTENT_ACCURACY);
        var location = this.parseInfoWithAccuracy(locationClassifier, message, common.INTENT_ACCURACY_0_98);
        var category = this.parseInfoWithAccuracy(categoryClassifier, message, common.INTENT_ACCURACY_0_98);
        logger.info('Ship intent = ' + intent + ' --- location = ' + location + ' ---- category = ' + category);
        if ((intent !== '' || location !== '') && category === '') {
            ret = true;
        }
        return ret;
    }

    this.getIntent = function (message) {
        var intents = [];
        var classifications = questionClassifier.getClassifications(message);
        for (var i = 0, length = classifications.length; i < length; i++) {
            var classification = classifications[i];
            if (classifications[i].value >= common.INTENT_ACCURACY_MEDIUM) {
                logger.info('High probility = ' + JSON.stringify(classification));
                // if (this.isShipIntent(message)) {
                    // var index = intents.indexOf(common.INTENT_CHECK_SHIP);
                    // if (index < 0) {
                        // intents.push(common.INTENT_CHECK_SHIP);
                    // } else {
                        // logger.info('Not add ship intent');
                    // }
                // } else {
                    intents.push(classification.label);
                // }
            } else {
                logger.info('Low probility = ' + JSON.stringify(classification));
                break;
            }
        }
        if (intents.length === 0) {
            intents.push(common.INTENT_UNKNOWN);
        }
        return intents;
    },

    this.parseProductType = function (userMsg) {
        var productType = [];
        for (var i = 0, length = typeRegexp.length; i < length; i++) {
            var type = common.extractValue(userMsg, typeRegexp[i]);
            if (type !== '') {
                productType.push(type);
            }
        }
        return productType;
    }

    this.removeClassiferFeatures = function (features, userMsg) {
        var wordList = Object.keys(features);
        var newUserMsg = this.removeRedundant(wordList, userMsg);
        return newUserMsg;
    }

    this.removeRedundant = function (wordList, userMsg) {
        var words = userMsg.split(' ');
        var newUserMsg = '';
        for (var i = 0, length = words.length; i < length; i++) {
            if (wordList.indexOf(words[i]) < 0) {
                newUserMsg += words[i] + ' ';
            } else {
                logger.info('Not handle redundant word: ' + words[i]);
            }
        }
        return newUserMsg;
    }

    this.removeNoMeaningWords = function (userMsg) {
        userMsg = this.removeRedundant(this.unprocessWordList, userMsg);
        return userMsg;
    }

    this.parseColorInfo = function (userMsg) {
        var productColor = []
        var classifications = propertiesClassifier.getClassifications(userMsg)
            for (var i = 0, length = classifications.length; i < length; i++) {
                var classification = classifications[i]
                if (classifications[i].value > common.INTENT_ACCURACY_LOW) {
                    logger.info('High probility = ' + JSON.stringify(classification))
                    productColor.push(classification.label.toLowerCase())
                } else {
                    logger.info('Low probility = ' + JSON.stringify(classification))
                    break
                }
            }
            logger.info('User message: ' + userMsg + '  => parseColorInfo => ' + productColor)
            return productColor
    }

    this.parseSizeInfo = function (userMsg) {
        var productSizes = []
        userMsg = userMsg.replaceAll('saiz', 'size')
            userMsg = userMsg.replaceAll('sai', 'size')
            userMsg = userMsg.replaceAll('sz', 'size')
            for (var i = 0, length = sizeRegexp.length; i < length; i++) {
                productSizes = common.extractValue(userMsg, sizeRegexp[i])
                    if (productSizes !== '') {
                        productSizes = common.extractValues(productSizes, '\\d+')
                            if (productSizes.length === 0) {
                                productSizes.push('all')
                            }
                            break
                    }
            }
            if (productSizes === '') {
                productSizes = []
            }
            return productSizes
    }

    this.parseQuantity = function (userMsg) {
        var productQuantity = []

        for (var i = 0, length = quantityRegexp.length; i < length; i++) {
            var quantities = common.extractValues(userMsg, quantityRegexp[i])
                if (quantities.length > 0) {
                    for (var j = 0, length = quantities.length; j < length; j++) {
                        var quantity = common.extractValue(quantities[j], '\\d+')
                            if (quantity === '') {
                                productQuantity.push('1')
                            } else {
                                productQuantity.push(quantity)
                            }
                    }
                    break
                }
        }
        return productQuantity
    }

    this.parseCategory = function (userMsg, quantityCount) {
        var category = this.parseInfoWithAccuracy(categoryClassifier, userMsg, common.INTENT_ACCURACY)
            return category
    }

    this.parsePriceIntent = function (userMsg, options) {            
        var productCode = common.extractProductCode(userMsg,
                options.codePattern).code;
        var productTypes = this.parseProductType(userMsg)
        var productQuantity = this.parseQuantity(userMsg)

        if (productTypes.length > 0) {
            for (var i = 0, length = productTypes.length; i < length; i++) {
                productQuantity[i] = '1'
            }
        } else if (productQuantity.length === 0) {
            productQuantity[0] = '1'
        } else {
            logger.info('productQuantity = ' + productQuantity)
        }

        var data = {
            intent: common.INTENT_CHECK_PRICE,
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            productid: options.productid,
            code: productCode,
            type: [],
            quantity: productQuantity,
            msg: userMsg
        }
        for (var i = 0; i < productTypes.length; i++) {
            data.type.push(productTypes[i])
        }
        return data
    }

    this.parseAvailabilityIntent = function (userMsg, options) {
        userMsg = this.removeClassiferFeatures(questionClassifier.features, userMsg)
            userMsg = this.removeRedundant(quantityRegexp, userMsg)
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
            if (productCode !== '') {
                data.category = productCode
            } else {
                var productQuantity = this.parseQuantity(userMsg)
                    var category = this.parseCategory(userMsg)
                    data.category = category
            }

            data.code = productCode
            data.color = color
            data.size = size
            data.intent = common.INTENT_CHECK_AVAILABILITY
            return data
    }

    this.parseInfoWithAccuracy = function (classifier, userMsg, accuracy) {
        var info = ''
            var classifications = classifier.getClassifications(userMsg)
            if (classifications.length > 0) {
                var classification = classifications[0]
                    if (classification.value > accuracy) {
                        info = classification.label
                        logger.info('Probability: ' + classification.label + ' - ' + classification.value)
                    }
            }
            return info
    }

    this.parseShipIntent = function (userMsg, options) {
        // userMsg = this.removeClassiferFeatures(questionClassifier.features, userMsg)
        var location = this.parseInfoWithAccuracy(locationClassifier, userMsg, common.INTENT_ACCURACY)
            var shipIntent = this.parseInfoWithAccuracy(shipClassifier, userMsg, common.INTENT_ACCURACY_LOW)
            var data = {
            storeid: options.storeid,
            pageid: options.pageid,
            fbid: options.fbid,
            // productid: options.productid,
            msg: userMsg,
            location: location
        }

        if (shipIntent !== '') {
            data.shipintent = shipIntent
        } else if (priceIntent === common.INTENT_CHECK_PRICE) {
            data.shipintent = common.SHIP_FEE
        }

        data.intent = common.INTENT_CHECK_SHIP
        return data
    }

    this.trainPriceClassifier()
    this.trainAvailabilityClassifier()
    this.trainShipClassifier()
    this.trainColorClassifier()
    this.trainCatergoryClassifier()
    this.trainLocationClassifier()
    this.trainOtherClassifier()
    this.loadTrainingDataFromDB();
}

var method = UserIntentParserNLP.prototype
    method.setEmitter = function (emitter) {
    this.emitter = emitter
}

method.parse = function (userMsg, options) {
    logger.info('Pre-processing: ' + userMsg)
    var userMsgAfterPreprocess = this.removeNoMeaningWords(userMsg.toLowerCase().latinise())
    logger.info('User MSG for intent parsing: ' + userMsgAfterPreprocess)
    var data = null
    var intents = this.getIntent(userMsgAfterPreprocess)
    for (var i = 0; i < intents.length; i++) {
        var intent = intents[i]
        if (intent === common.INTENT_CHECK_PRICE) {
            logger.info('parsePriceInfo for customer')
            data = this.parsePriceIntent(userMsgAfterPreprocess, options)
        } else if (intent === common.INTENT_CHECK_AVAILABILITY) {
            logger.info('parseAvailabilityIntentData for customer')
            data = this.parseAvailabilityIntent(userMsgAfterPreprocess, options)
        } else if (intent === common.INTENT_CHECK_SHIP) {
            logger.info('parseShipInfo for customer')
            data = this.parseShipIntent(userMsgAfterPreprocess, options)
        } else if (intent === common.INTENT_CHECK_SALEOFF) {
            logger.info('parseSaleoffInfo for customer')
            data = options;
            data.intent = intent;
        } else {
            data = this.parseAvailabilityIntent(userMsgAfterPreprocess, options)
            if ((data.category === '') && (data.color.length === 0) && (data.size.length === 0)) {
                logger.info('not parse message ' + userMsgAfterPreprocess + ' ==> will call staff for support')
                data.intent = common.INTENT_UNKNOWN
            }
        }
        if (userMsgAfterPreprocess !== '') {
            logger.info('[Check ' + data.intent + '] Data sent from intent parser to sale bot' + JSON.stringify(data))
            this.emitter.emit(data.intent, data)
        }else{
            logger.info("Do nothing for empty message");    
        }
        // Save log for applying NLP
        var moment = require('moment')
        moment.locale('vn')
        data.timestamp = moment().format('LLLL')
        data.msg = userMsg
        common.saveToFile('nlp_log.txt', '\n' + JSON.stringify(data))
        logger.info("Finish handling NLP");
    }
}

module.exports = UserIntentParserNLP
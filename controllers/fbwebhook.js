'use strict';
var bodyParser = require('body-parser');
var express = require('express');
var validator = require("email-validator");
var request = require('request');
var JSONbig = require('json-bigint');
var server = express();
var EventEmitter = require('events');
var emitter = new EventEmitter();

var config = require("../config/config.js");
var common = require("../util/common");
var logger = require("../util/logger.js");

var gModelFactory = require("../dal/model_factory.js");
var gProductFinder = require('../dal/product_finder.js');

var SessionManager = require("../dal/session_manager.js");
var sessionManager = new SessionManager();

var ParserFactory = require("../processors/user_intent_parser_factory.js");
var parserFactory = new ParserFactory();
var intentParser = null;

var FBMessenger = require("../io/fbmessenger.js");
var fbMessenger = new FBMessenger();

var gStoreConfig = {};
var gPagesInfo = [];
var gStoreSupport = {};
var gUseAIServiceFlag = false;
var async = require("async");

function timeConverter(UNIX_timestamp) {
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
    return time;
}

//=============================================================//
// Send searching or purchasing results to Customer FB messager
//=============================================================//
function createAndSendOrderToFB(session, callback) {
    var orderInfo = sessionManager.getOrderInfo(session);
    gProductFinder.getOrderItems(orderInfo.id, function (items) {
        if (items.length > 0) {
            var sub_total = 0;
            var invoiceItems = [];

            // change from server time zone to VN time zone
            var timestamp = parseInt(items[0].Invoice.dataValues.creation_date) + 13 * 3600 * 1000;
            logger.info("Before slicing" + timeConverter(timestamp / 1000));

            var length = ("" + timestamp).length;
            var delta = length - 10;
            if (delta > 0) {
                session.last_invoice.creation_date = items[0].Invoice.dataValues
                    .creation_date.slice(0, -1 * delta);
            }
            logger.info("After slicing" + timeConverter(parseInt(session.last_invoice.creation_date)));

            var productCount = 0;
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var title = item.Product.dataValues.title;
                var subtitle = "";
                var type = (common.isDefined(item.dataValues.type)) ? item.dataValues.type : "";
                var prices = common.extractProductPrices(title);
                logger.info("Type = " + type + " price = " + prices[type]);
                var price = (prices[type] != undefined) ? parseInt(prices[type]) : item.Product.dataValues.price;
                if (prices[type] != undefined) {
                    subtitle += " Kiểu " + common.getProductTypeVN(type) + ", ";
                }
                subtitle += "Màu " + common.get_color_vn(item.Color.dataValues.name) + ", Size " + item.Size.dataValues.value;
                var quantity = item.dataValues.quantity;
                var thumbnail_url = item.Product.dataValues.thumbnail;
                productCount += quantity;

                var jsonitem = fbMessenger.createOrderItemElement(
                        title, subtitle, price, quantity, thumbnail_url);
                invoiceItems.push(jsonitem);
                sub_total += (price * quantity);
            }

            var storeSupport = gStoreSupport[session.storeid];
            calculateShipFee(orderInfo.address, storeSupport, function (fee) {
                var from2ndProductShipFee = (fee === 0) ? 0 : storeSupport.fee.more;
                var shipFee = (productCount === 0) ? 0 : ((productCount - 1) * from2ndProductShipFee + fee);
                var invoiceSummary = {
                    "subtotal": sub_total / 100,
                    "shipping_cost": shipFee / 100,
                    "total_tax": sub_total * storeSupport.vat / 100,
                    "total_cost": (sub_total + shipFee + sub_total * storeSupport.vat) / 100
                };

                var invoiceAdjustments = {};

                fbMessenger.sendReceiptMessage(session.fbid, session.token, invoiceItems,
                    orderInfo, invoiceSummary, invoiceAdjustments, callback);
            });

        } else {
            logger.error("Can not find any order item");
        }
    });
}

function createAndSendOrderToStore(session, callback) {
    gProductFinder.getOrderItems(session.last_invoice.id, function (items) {
        for (var i = 0; i < items.length; i++) {
            var order = gStoreConfig.order_form;
            request({
                url: gHomepage,
                method: 'POST',
            }, function (error, response, body) {
                if (error) {
                    logger.error('Error sending message: ' + error.stack);
                } else if (response.body.error) {
                    logger.error('Error: ' + JSON.stringify(response.body.error));
                } else {
                    if (callback != null) {
                        callback();
                    }
                }
            });
        }
    });
}

function sendCategorySearchResultsToFB(session, categories) {
    if (categories.length > 0) {
        async.series([
                function (callback) {
                    // fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn xem danh mục sản phẩm bên dưới nhé");
                    callback(null);
                },
                function sendResultsToFB() {
                    var foundCategories = null;
                    var results = [];
                    if (Array.isArray(categories)) {
                        foundCategories = categories;
                    } else {
                        foundCategories = [];
                        foundCategories.push(categories);
                    }
                    fbMessenger.sendCategoriesElements(session.fbid, session.token, foundCategories);
                    if (foundCategories.length == 1) {
                        SessionManager(session, foundCategories[0].id);
                    }
                }
            ]);
    } else {}
}

function sendProductSearchResultsToFB(session, products) {
    var keys = Object.keys(products);
    if (keys.length > 0) {
        async.series([
                function (callback) {
                    fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_product_found, function () {
                        callback(null);
                    });
                },
                function sendResultsToFB() {
                    var found_products = null;
                    var results = [];
                    if (Array.isArray(products)) {
                        found_products = products;
                    } else {
                        found_products = [];
                        found_products.push(products);
                    }
                    if (found_products.length == 1) {
                        sessionManager.setProductInfo(session, {
                            id: found_products[0].id,
                            title: found_products[0].title
                        });
                        sessionManager.setCategoryId(session, found_products[0].CategoryId);
                        //showAvailableColorNsize(session, true, true, true);
                    } 
                    //else {
                        fbMessenger.sendProductElements(session.fbid, session.token, found_products);
                    //}
                }
            ]);
    } else {
        showSimilarProductSuggestion(session);
    }
}

function searchAndConfirmAddress(session, destination, callback) {
    // Handle a text message from this sender
    common.searchAddress(destination, function (result) {
        if (result.length > 0) {
            var length = 1; //result.length;
            for (var i = 0; i < length; i++) {
                logger.info("Full address: " + result[i].formattedAddress);
                fbMessenger.sendAddressConfirmMessage(session.fbid,
                    session.token, result[i].formattedAddress);
                callback(result[i].formattedAddress);
            }
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Không tìm thấy địa chỉ. Bạn nhập lại địa chỉ nhé.",
                function () {
                callback(null);
            });
        }
    });
}
//=============================================================//

function getAvailableColorMsg(show_color, colors, reference) {
    var availableColorMessage = "";
    var referColorsString = reference.toString().replaceAll(" ", '');
    referColorsString = referColorsString.replaceAll(",", '');
    referColorsString = referColorsString.toLowerCase();
    
    logger.info("referColorsString = " + referColorsString);
    
    if (show_color) {
        availableColorMessage = "\n- Màu sắc: ";
        var matchColorStr = "";
        var availableColors = "";
        if (colors != null && colors.length > 0) {
            for (var i = 0; i < colors.length; i++) {
                logger.info("colors[i].name = " + colors[i].name);
                if (referColorsString.indexOf(colors[i].name) >= 0) {
                    matchColorStr += colors[i].name + ", ";//common.get_color_vn(colors[i].name) + ", ";
                } else {}
                availableColors += colors[i].name;//common.get_color_vn(colors[i].name) + ", ";
            }
            logger.info("matchColorStr = " + matchColorStr);
            if (matchColorStr === "") {
                availableColorMessage = "Màu sắc bạn tìm hiện không còn.";
                availableColorMessage += " Bạn vui lòng xem màu còn hàng bên dưới: \n";
                availableColorMessage += " - " + availableColors.slice(0, -2);

            } else {
                availableColorMessage += matchColorStr.slice(0, -2);
            }
        } else {
            availableColorMessage += common.status_updating;
        }
    }
    return availableColorMessage;
}

function getAvailableSizeMsg(show_size, sizes, reference) {
    var availableSizesMesage = "";
    var referSizesString = reference.toString().replaceAll(" ", '');
    referSizesString = referSizesString.replaceAll(",", '');
    referSizesString = referSizesString.toLowerCase();
    if (show_size) {
        availableSizesMesage = "\n- Size: ";
        var matchSizes = "";
        var availableSizes = "";
        if (sizes != null && sizes.length > 0) {
            for (var i = 0; i < (sizes.length - 1); i++) {
                if (referSizesString.indexOf(sizes[i].value) >= 0) {
                    matchSizes += sizes[i].value + ", ";
                } else {}
                availableSizes += sizes[i].value + ", ";
            }
            if (matchSizes === "") {
                availableSizesMesage = "Size bạn tìm hiện tại không còn.";
                availableSizesMesage += "Bạn vui lòng xem size còn hàng bên dưới: \n";
                availableSizesMesage += "- " + availableSizes.slice(0, -2);
            } else {
                availableSizesMesage += matchSizes.slice(0, -2);
            }
        } else {
            availableSizesMesage += common.status_updating;
        }
    }
    return availableSizesMesage;
}

function showAvailableColorNsize(session, showColorFlag,
    showSizeFlag, showPhotoFlag) {
    var productInfo = sessionManager.getProductInfo(session);
    gProductFinder.getColorsNSizeNPhotos(productInfo.id,
        function (colors, sizes, photos) {
        var availableColorsMsg = getAvailableColorMsg(showColorFlag, colors, JSON.stringify(colors));
        var availableSizesMsg = getAvailableSizeMsg(showSizeFlag, sizes, JSON.stringify(sizes));
        logger.info("Product id = " + productInfo.id + " Details - " + availableColorsMsg + availableSizesMsg);
        if (showPhotoFlag && photos.length > 0) {
            fbMessenger.sendProductPhotoElements(session.fbid, session.token, productInfo.id,
                productInfo.title, availableColorsMsg + availableSizesMsg, photos);
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                availableColorsMsg + availableSizesMsg);
        }
    });
}

function showAvailableColorNsizeNew(session, showColorFlag,
    showSizeFlag, showPhotoFlag) {
    var productInfo = sessionManager.getProductInfo(session);
    var availableColorsMsg = "";
    var availableSizesMsg = "";
    var availablePhotoLinks = [];
    gProductFinder.getProductProperties(productInfo.id,
        function (properties) {
        for(var i = 0; i < properties.length; i++){
            if('color' === properties[i].name){
                availableColorsMsg += properties[i].svalue + ", ";
            }else if('size' === properties[i].name){
                availableSizesMsg += properties[i].ivalue + ", ";
            }else if('photo' === properties[i].name){
                availablePhotoLinks.push(properties[i].svalue);
            }else{
                logger.info("Skipped this property: " + JSON.stringify(properties[i]));
            }
        }
        availableColorsMsg += availableColorsMsg.slice(0, -2);
        availableSizesMsg += availableSizesMsg.slice(0, -2);
        var productDetails = "";
        
        if(availableColorsMsg !== ""){
            productDetails += "Màu sắc: " + availableColorsMsg;
        }

        if(availableSizesMsg !== ""){
            productDetails += "Size: " + availableSizesMsg;
        }
        
        if (showPhotoFlag && availablePhotoLinks.length > 0) {
            logger.info("Will show photo: " + availablePhotoLinks);
            fbMessenger.sendProductPhotoElements(session.fbid, session.token, productInfo.id,
                productInfo.title, productDetails, availablePhotoLinks);
        } else {
            logger.info("Will not show photo: ");
            fbMessenger.sendTextMessage(session.fbid, session.token,
                availableColorsMsg + availableSizesMsg);
        }
    });
}

// =================================================================
// Methods for search product
// =================================================================
function showSimilarProductSuggestion(session) {
    // send suggestion for products in same category
    async.series([
            function (callback) {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_product_notfound, function () {
                    callback(null);
                });
            },
            function (callback) {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_product_similar, function () {
                    callback(null);
                });
            },
            function (callback) {
                var categoryInfo = sessionManager.getCategoryInfo(session);
                if (categoryInfo.id >= 0) {
                    showProductsByCategoryId(session, categoryInfo.id);
                } else {
                    showAllCategories(session);
                }
            }
        ]);
}

function showProductSearchHelp(session){
    fbMessenger.sendTextMessage(session.fbid, session.token, 
        "Bạn vui lòng xem hướng dẫn sử dụng bên dưới", function () {});

    setTimeout(function () {
        fbMessenger.sendTextMessage(session.fbid, session.token, 
        "- Tìm kiếm sản phẩm theo mã code hoặc text hoặc upload ảnh từ website", function () {
            fbMessenger.sendTextMessage(session.fbid, session.token, 
            "Ví dụ: tôi muốn tìm giầy da nam màu xanh size 40", function () {});
        });
    }, 100);
}

function showSupportInfoHelp(session){
    setTimeout(function () {
        fbMessenger.sendTextMessage(session.fbid, session.token, 
        "- Check chương trình khuyến mại / giảm giá sốc, hàng mới về", function () {
            fbMessenger.sendTextMessage(session.fbid, session.token, 
            "Ví dụ: shop còn chương trình khuyến mại nào ko", function () {});
        });
    }, 200);
    setTimeout(function () {
        fbMessenger.sendTextMessage(session.fbid, session.token, 
        "- Kiểm tra thông tin về ship hàng", function () {
            fbMessenger.sendTextMessage(session.fbid, session.token, 
            "Ví dụ: Shop có ship hàng về Hải Phòng không? Mất bao lâu? Giá ship thế nào", function () {});
        });
    }, 300);
}

function findProductByThumbLink(session, thumbLink) {
    gProductFinder.findProductByThumbnail(session.storeUrl, thumbLink, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function findProductByThumbnailLinkOnStore(session, link) {
    gProductFinder.findProductByThumbnailOnStore(session.storeid, link, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function findProductByDetailLink(session, link) {
    gProductFinder.findProductByThumbnailOnStore(session.storeid, link, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function findProductByKeywords(session, keywords) {
    gProductFinder.findShoesByKeywords(session.storeid, keywords, function (products) {
        sendProductSearchResultsToFB(session, products);
    });
}

function findProductByCode(session, productCode) {
    gProductFinder.findProductByCode(session.storeid, productCode, function (product) {
        sendProductSearchResultsToFB(session, product);
    });
}

function showProductsByCategoryId(session, categoryId) {
	logger.info("[showProductsByCategoryId]storeid = " + session.storeid);
	logger.info("[showProductsByCategoryId]categoryId = " + categoryId);
    gProductFinder.findProductsByCategoryId(session.storeid, categoryId,
        function (products) {
        if (Object.keys(products).length > 0) {
			
            sendProductSearchResultsToFB(session, products);
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Không tìm thấy sản phẩm nào. Bạn vui lòng chọn danh mục khác");
        }
    });
}

function showAllCategories(session) {
    gProductFinder.findAllCategoriesByStoreId(session.storeid, function (categories) {
        sendCategorySearchResultsToFB(session, categories);
    });
}

function searchProducts(session, user_msg, storeconfig) {
    if (common.isThumbUrl(user_msg)) {
        gProductFinder.findStoreById(session.storeid, function(store){
            if(user_msg.startsWith(store.home)){
                findProductByThumbnailLinkOnStore(session, user_msg);
            }else{                
                findProductByThumbLink(session, user_msg);
            }
        });
    } else if (common.isUrl(user_msg)) {
        findProductByDetailLink(session, user_msg);
    }else {
        //findProductByKeywords(session, user_msg.latinise());
        logger.info("Cannot handle message");
    }
}

//============================================================================//
// Following method is for user to select product properties as buying form
function selectProductColor(session, user_message) {
    var orderInfo = sessionManager.getOrderInfo(session);
    var productInfo = sessionManager.getProductInfo(session);
    if (orderInfo.id == -1) {
        gModelFactory.createInitialInvoice(session.fbid,
            function (invoice) {
            sessionManager.setOrderInfo(session, {
                id: invoice.id
            });
        });
    } else {}

    // Remove mua word to get color value
    var color_keyword = user_message.replaceAll(common.SEARCH_KEY_COLOR, "")
        .replaceAll(" ", "").trim();
    gProductFinder.checkProductByColor(productInfo.id,
        color_keyword,
        function (color) {
        if (color != null) {
            sessionManager.setUserAction(session, common.select_product_color);
            sessionManager.setProductInfo(session, {
                color: color.id
            });
            var type = sessionManager.getProductInfo(session).type;
            gProductFinder.getProductSizes(productInfo.id, function (sizes) {
            if(sizes.length > 1){
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_size, function () {
                    if (type === common.PRODUCT_TYPE_COMBO) {
                        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_size_combo);
                    }
                    showAvailableColorNsize(session, false, true, false);
                });
            }else{
                sessionManager.setUserAction(session, common.select_product_size);
            }
        });
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_color_notfound,
                function () {
                showAvailableColorNsize(session, true, false, false);
            });
        }
    });
}
//============================================================================//
function selectProductSize(session, user_message) {
    var productInfo = sessionManager.getProductInfo(session);
    var size = common.extractValue(user_message, "\\d+$");
    gProductFinder.checkProductBySize(productInfo.id,
        size,
        function (size) {
        //if (Object.keys(size).length > 0) {
            sessionManager.setUserAction(session, common.select_product_size);
            sessionManager.setProductInfo(session, {
                size: size.id
            });
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_quantity);
/*        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.notify_size_notfound,
                function () {
                showAvailableColorNsize(session, false, true, false);
            });
        }
*/
    });
}

function selectProductQuantity(session, user_message) {
    var productInfo = sessionManager.getProductInfo(session);
    var orderInfo = sessionManager.getOrderInfo(session);
    var lastAction = sessionManager.getLastAction(session);
    logger.debug("Order Quantity: " + user_message);
    var quantity = common.extractValue(user_message, "\\d+");
    if (productInfo.type === common.PRODUCT_TYPE_COMBO) {}
    else {
        gModelFactory.createFashionOrderItem(productInfo.type,
            quantity,
            orderInfo.id,
            productInfo.id,
            productInfo.color,
            productInfo.size,
            function (saved_item) {
            logger.info("saved_item: " + JSON.stringify(saved_item));
            sessionManager.setUserAction(session, common.action_continue_search);
            fbMessenger.sendPurchaseConfirmMessage(session.fbid, session.token,
                "Bạn muốn tiếp tục chọn sản phẩm hay đặt hàng ngay?");
        });
    }
}

function putProductToCart(session, text) {
    var user_req_trans = text.latinise().toLowerCase();
    var productInfo = sessionManager.getProductInfo(session);
    var orderInfo = sessionManager.getOrderInfo(session);
    var lastAction = sessionManager.getLastAction(session);
    if (session.last_action === common.select_type) {
        selectProductColor(session, user_req_trans);
    } else if (session.last_action === common.select_product_color) {
        selectProductSize(session, text);
    } else if (session.last_action === common.select_product_size) {
        selectProductQuantity(session, text);
    }
}

function makeProductOrder(session, text) {
    logger.info("Filling order information: " + text + "Start");
    if (session.last_action === common.set_quantity) {
        logger.debug("Name: " + text);
        sessionManager.setUserAction(session, common.set_recipient_name);
        sessionManager.setOrderInfo(session, {
            name: text
        });
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_phone);
    } else if (session.last_action === common.set_recipient_name) {
        logger.debug("Phone: " + text);
        if (common.validateVNPhoneNo(text)) {
            sessionManager.setUserAction(session, common.set_phone);
            sessionManager.setOrderInfo(session, {
                phone: text
            });
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_address);
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn đã nhập sai định dạng số DT", function () {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_phone);
            });
        }
    } else if (session.last_action === common.set_phone) {
        logger.debug("Address: " + text);
        searchAndConfirmAddress(session, text, function (formattedAddress) {
            if (formattedAddress !== null) {
                sessionManager.setOrderInfo(session, {
                    address: formattedAddress
                });
            } else {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_address);
            }
        });
    } else if (session.last_action === common.set_address) {
        logger.debug("Email: " + text);
        var is_valid_email = validator.validate(text);
        if (is_valid_email) {
            sessionManager.setUserAction(session, common.set_email);
            sessionManager.setOrderInfo(session, {
                email: text
            });
            //fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_delivery_date);
            createAndSendOrderToFB(session, function () {
                fbMessenger.sendOrderConfirmMessage(session.fbid, session.token, "Xác nhận đơn hàng!");
            });
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_email);
        }
        // } else if (session.last_action === common.set_email) {
        //     logger.debug("Delivery: " + text);
        //     sessionManager.setUserAction(session, common.set_delivery_date);
        //     sessionManager.setOrderInfo(session, {
        //         delivery: text
        //     });
        // } else if (session.last_action === common.set_delivery_date) {
        // createAndSendOrderToFB(session, function () {
        //     fbMessenger.sendOrderConfirmMessage(session.fbid, session.token, "Xác nhận đơn hàng!");
        // });
    } else {
        logger.info("Unknow action = " + text);
    }
    logger.info("Filling order information: " + text + " for " + session.last_action + " END ");
    logger.info("Order ID " + sessionManager.getOrderInfo(session).id + " - Filling order information: " + text + " for " + session.last_action + " END ");
}

function cancelOrder(session) {
    var invoice_id = session.last_invoice.id;
    var status = "cancel";
    var orderInfo = sessionManager.getOrderInfo(session);

    gModelFactory.cancelInvoice(orderInfo.id, status,
        function (invoice) {
        sessionManager.resetSession(session);
    });
    sessionManager.setUserAction(session, common.say_greetings);
    fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
}

//=====================================================================//
//================= Process User Intent=================================//
//=====================================================================//
function findLastSelectProduct(session, data, callback) {
    if (common.isDefined(data.category) 
		&& (data.category != "") 
		&& (data.code != data.category)) {
        callback(null);
    } else if (common.isDefined(data.code) && data.code.length > 0) {
        gProductFinder.findProductByCode(session.storeid, data.code, function (product) {
            if (Object.keys(product).length > 0) {
                sessionManager.setProductIdNTitle(session, product.id, product.title);
            }
            callback(product);
        });
    } else if (data.productid >= 0) {
        gProductFinder.findProductById(data.productid, function (product) {
            callback(product);
        });
    } else {
        callback(null);
    }
}

function getProductPriceMessage(quantity, price, title, requestType, saleoffmsg) {
    var message = "";
    var typeVN = {
        nam: "Nam",
        nu: "Nữ",
        combo: "Combo"
    };
    var prices = common.extractProductPrices(title);
    var priceForType = prices[requestType];
    logger.info("prices[" + requestType + "] = " + price);
    if ((priceForType != undefined) && priceForType != "000") {
        priceForType = common.toCurrencyString(price * quantity, "VNĐ");
        message += "- " + priceForType + saleoffmsg + "\n";
    } else {
        if (title.latinise().indexOf(requestType) < 0) {
            message += "- Sản phẩm này không có kiểu " + typeVN[requestType] + " mà bạn đang tìm\n";
        } else {
            message += "- Kiểu nữ giá ";
        }
        message += quantity + " đôi " + common.toCurrencyString(price * quantity, " VNĐ") + saleoffmsg;
    }
    return message;
}

function handlePriceIntent(session, data, product) {
    logger.info("Extracted INTENT CHECK_PRICE: " + JSON.stringify(data));
    sessionManager.setProductInfo(session, {
        id: product.id,
        title: product.title
    });
    sessionManager.setCategoryId(session, product.CategoryId);
    if (Object.keys(product).length) {
        var price = (product.price > product.discount) ? product.discount : product.price;
        var delta = (product.price - product.discount);
        var saleoffmsg = product.price > product.discount ? " (Có KM " + common.toCurrencyString(delta, " VNĐ") : " (Không có KM)";
        var message = product.title;
        fbMessenger.sendTextMessage(data.fbid, session.token, message, function () {
            message = "";
            if (data.type.length > 0) {
                var productTitle = product.title.latinise().toLowerCase();
                for (var i = 0, length = data.type.length; i < length; i++) {
                    message = getProductPriceMessage(data.quantity[i], price, product.title, data.type[i], saleoffmsg);
                    fbMessenger.sendTextMessage(data.fbid, session.token, message);
                }
            } else {
                message = "- " + data.quantity[0] + " đôi " + " giá " + common.toCurrencyString(price * data.quantity[0], " VNĐ") + saleoffmsg; ;
                fbMessenger.sendTextMessage(data.fbid, session.token, message);
            }
            var showPhotos = (data.productid != product.id) ? true : false;
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Bạn xem thêm thông tin về màu và size bên dưới nhé",
                function () {
                showAvailableColorNsizeNew(session, true, true, showPhotos);
            });
        });
    } else {
        showSimilarProductSuggestion(session);
    }
}

function searchFashionProducts(session, storeid, category, sizes, colors){
	var querydata = {
		category: category,
		sizes: sizes.toString().replaceAll("[", "").replaceAll("]", ""),
		colors: colors.toString().replaceAll("[", "").replaceAll("]", "").replaceAll(",", "','")
	};
	gProductFinder.findShoesByKeywordsOpt(storeid, querydata, function (products) {
		if (products.length >= 1) {
			sessionManager.setProductInfo(session, {
				id: products[0].id,
				title: products[0].title
			});
			sessionManager.setCategoryId(session, products[0].CategoryId);
			fbMessenger.sendTextMessage(session.fbid, session.token, "Sản phẩm còn hàng :)", function () {
				sendProductSearchResultsToFB(session, products);
			});
		} else if (category.length > 0){
			var colors = [];
			var sizes = [];
			searchFashionProducts(session, storeid, category, sizes, colors);	
		}else {
			showSimilarProductSuggestion(session);
		}
	});
}

function handleAvailabilityIntent(session, data, product) {
	
    if (product != null) {
        data.category = (data.code === "") ? product.code : data.category;
    }

	var currentCategoryText;
    if(data.category.length === 0){
		var categoryInfo = sessionManager.getCategoryInfo(session);
		currentCategoryText = categoryInfo.title;
    }else{
		currentCategoryText = data.category;
		sessionManager.setCategoryInfo(session, {title: currentCategoryText});
	}
	
	if(currentCategoryText.length === 0){
		fbMessenger.sendTextMessage(session.fbid, session.token, 
		"Không tìm thấy danh mục sản phẩm", function () {
			showProductSearchHelp(session);
		});
		return;	
	}
		
	if(data.size.length * data.color.length > 0) {
		searchFashionProducts(session, data.storeid, currentCategoryText, data.size, data.color);
	}else{
		var productInfo = sessionManager.getProductInfo(session);
		if(productInfo.id != -1){
			if (data.color.length === 0) {
				fbMessenger.sendTextMessage(session.fbid, session.token,
					"Bạn chọn thêm màu bên dưới nhé",
					function () {
					showAvailableColorNsizeNew(session, true, false, false);
				});
			}else if (data.size.length === 0) {
				fbMessenger.sendTextMessage(session.fbid, session.token,
					"Bạn chọn thêm size bên dưới nhé\n",
					function () {
					showAvailableColorNsizeNew(session, false, true, false);
				});
			}
		}else{
			fbMessenger.sendTextMessage(session.fbid, session.token,
				"Bạn nhập thêm thông tin về size / màu sắc\n");
		}
	}
}

function calculateShipFee(shipTarget, storeSupport, callback) {
    common.calculateDistance(storeSupport.address[0], shipTarget, function (distance) {
        var keys = Object.keys(storeSupport.fee);
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            var keyInt = parseInt(key);
            if (keyInt >= distance) {
                var fee = storeSupport.fee[key];
                callback(fee);
                break;
            }
        }
    });
}

function calculateShipDuration(shipTarget, storeSupport, callback) {
    common.calculateDistance(storeSupport.address[0], shipTarget, function (distance) {
        var keys = Object.keys(storeSupport.duration);
        for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            var keyInt = parseInt(key);
            if (keyInt >= distance) {
                var fee = storeSupport.duration[key];
                callback(storeSupport.duration[key]);
                break;
            }
        }
    });
}

function handleShipIntent(data) {
    var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
    logger.info("Extracted INTENT CHECK_SHIP: " + JSON.stringify(data));
    var showShipFee = false;
    var showShipDuration = false;
    gProductFinder.findStoreById(data.storeid, function (store) {
        var storeSupport = gStoreSupport[store.id];

        if (data.location != "" && data.shipintent != common.SHIP_FREE_SHIP) {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Có ship về " + data.location + " bạn nhé");
        }

        if (data.shipintent === common.SHIP_FEE) {
            showShipFee = true;
        } else if (data.shipintent === common.SHIP_DURATION) {
            showShipDuration = true;
        } else if (data.shipintent === common.SHIP_RANGE) {
            showShipFee = true;
            showShipDuration = true;
        } else if (data.shipintent === common.SHIP_FREE_SHIP) {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Shop có free ship nội thành Hà Nội nhé :)");//+ storeSupport.free_ship);
        } else if (data.shipintent === common.SHIP_COD) {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Shop có COD bạn nhé.");
        } else {
            fbMessenger.sendTextMessage(session.fbid, session.token,
                "Shop chưa hiểu ý bạn. Bạn vui lòng gửi lại thông tin");
        }

        if (showShipFee) {
            calculateShipFee(data.location, storeSupport, function (fee) {
                logger.info("Ship fee = " + fee);
                fbMessenger.sendTextMessage(session.fbid, session.token,
                    "Giá ship: " + fee / 1000 + "K VND cho đôi đầu tiên.\nTừ đôi thứ 2 thì tính thêm " + storeSupport.fee.more / 1000 + "K VND /đôi.\nCOD cộng thêm 20 K VNĐ");
            });
        }

        if (showShipDuration) {
            calculateShipDuration(data.location, storeSupport, function (duration) {
                logger.info("Ship Duration = " + duration);
                fbMessenger.sendTextMessage(session.fbid, session.token,
                    "Thời gian ship: " + duration);
            });
        }
    });
}

function setUpUserIntentListener() {
    emitter.on(common.INTENT_CHECK_PRICE, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        if((data.productid == -1) && (data.code == "")) return;
        findLastSelectProduct(session, data, function (product) {
            if (product != null) {
                handlePriceIntent(session, data, product);
            } else {
                showSimilarProductSuggestion(session);
            }
        });
    });

    emitter.on(common.INTENT_CHECK_AVAILABILITY, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        findLastSelectProduct(session, data, function (product) {
            handleAvailabilityIntent(session, data, product);
        });
    });

    emitter.on(common.INTENT_CHECK_SHIP, function (data) {
        handleShipIntent(data);
    });

    emitter.on(common.INTENT_CHECK_SALEOFF, function (data) {
        var storeconfig = gStoreConfig[data.storeid];
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        //logger.info('Store Info ' + JSON.stringify(storeconfig))
        //logger.info('Store Saleoff Info ' + JSON.stringify(storeconfig.saleoff))
        var link = storeconfig.saleoff;
        fbMessenger.sendTextMessage(session.fbid, session.token, 
            "Bạn xem thêm thông tin khuyến mại bên dưới nhé", function(){
            fbMessenger.sendLinkMessage(session.fbid, session.token, link);
        });
    });
    
    emitter.on(common.INTENT_GENERAL_SEARCH, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        processTextEvent(session, data.msg);
    });

    emitter.on(common.INTENT_UNKNOWN, function (data) {
        var session = sessionManager.findOrCreateSession(data.storeid, data.pageid, data.fbid);
        fbMessenger.sendTextMessage(session.fbid, session.token, "Shop không tìm thấy sản phẩm theo yêu cầu :(", function () {
            //fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn vui lòng xem thêm thông tin. Shop sẽ check giúp bạn :)");
            // setTimeout(function () {
                // fbMessenger.sendTextMessage(session.fbid, session.token, "Bạn xem thêm danh mục sản phẩm bên dưới");
                // showAllCategories(session);
            // }, 100);
            showProductSearchHelp(session);
        });
    });
}

//=====================================================================//
//================= Process FB Message=================================//
//=====================================================================//

function processTextEvent(session, user_msg, storeconfig) {
    logger.info("processTextEvent: " + user_msg);
    var user_req_trans = user_msg.latinise().toLowerCase();
    var last_action_key = session.last_action;
    var last_action = common.sale_steps.get(last_action_key);
    var selectProductAction = common.sale_steps.get(common.select_product);
    var selectQuantityAction = common.sale_steps.get(common.set_quantity);
    var selectDeliveryDateAction = common.sale_steps.get(common.set_delivery_date);

    if (user_req_trans === common.action_terminate_order) {
        cancelOrder(session);
    } else if ((last_action >= selectProductAction) && last_action < selectQuantityAction) {
        putProductToCart(session, user_msg);
    } else if ((last_action >= selectQuantityAction) && last_action <= selectDeliveryDateAction) {
        makeProductOrder(session, user_msg);
    } else {
        logger.error("Unknow message: " + user_msg);
    }
}

function processPostbackEvent(session, action_details) {
    var user_action = action_details.action;
    var productInfo = sessionManager.getProductInfo(session);
    var orderInfo = sessionManager.getOrderInfo(session);

    logger.info("processPostbackEvent: " + JSON.stringify(action_details));

    if (user_action === common.action_view_details) {
        sessionManager.setProductIdNTitle(session,
            action_details.id, action_details.title);
        showAvailableColorNsize(session, true, true, true);
    } else if (user_action === common.action_view_category) {
		sessionManager.setCategoryInfo(session, {id:action_details.id, title:action_details.title});
		logger.info("[processPostbackEvent]storeid = " + session.storeid);
		logger.info("[processPostbackEvent]categoryId = " + action_details.id);
		showProductsByCategoryId(session, action_details.id);
     // this is for MENU items
    } else if (user_action === common.action_show_similar) {
		var categoryInfo = sessionManager.getCategoryInfo(session);
		showProductsByCategoryId(session, categoryInfo.id);
     // this is for MENU items
    } else if (user_action === common.action_view_categories) {
        showAllCategories(session);
    } else if (user_action === common.action_view_help) {
        showProductSearchHelp(session);
		showSupportInfoHelp(session);
    } else if (user_action === common.action_call_staff) {
        logger.info("Call Staff");
		sessionManager.callStaff(session, true);
		fbMessenger.sendTextMessage(session.fbid, session.token,
			"Xin bạn vui lòng đợi trong giây lát. Nhân viên tư vấn sẽ hỗ trợ bạn\n");
    } else if (user_action === common.action_talk_bot) {
        logger.info("Call BOT");
		sessionManager.callStaff(session, false);
		fbMessenger.sendTextMessage(session.fbid, session.token,
			"Tiếp tục tìm kiếm và đặt hàng với Chatbot\n");
    } else if (user_action === common.action_order) {
        sessionManager.setOrdeTrigerStatusInfo(session, true);
        sessionManager.setProductIdNTitle(session,
            action_details.id, action_details.title);
        var types = common.getAvailableProductType(productInfo.title);
        if (types.length <= 1 /*Only one type or not determined*/) {
            sessionManager.setUserAction(session, common.select_type);
            gProductFinder.getProductColors(productInfo.id, function (colors) {
                if(colors.length > 0){
                    fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_color,
                    function () {
                        showAvailableColorNsize(session, true, false, false);
                    });
                }else{
                    sessionManager.setUserAction(session, common.select_product_size);
                }
            });
        } else {
            var typeLabel = {
                nam: 'Giầy Nam',
                nu: 'Giầy Nữ',
                combo: "Combo (Nam + Nữ)"
            };
            fbMessenger.sendProductTypeConfirm(session.fbid, session.token, "Bạn vui lòng chọn kiểu sản phẩm:",
                typeLabel);
        }
    } else if (user_action === common.action_confirm_type) {
        sessionManager.setUserAction(session, common.select_type);
        sessionManager.setProductInfo(session, {
            type: action_details.type
        });
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_color,
            function () {
            var type = sessionManager.getProductInfo(session).type;
            if (type === common.PRODUCT_TYPE_COMBO) {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product_color_combo);
            }
            showAvailableColorNsize(session, true, false, false);
        });
    } else if (user_action === common.action_continue_search) {
        if (!orderInfo.isOrdering || session.last_action === common.action_continue_search) {
            sessionManager.setUserAction(session, common.say_greetings);
            sessionManager.setOrdeTrigerStatusInfo(session, false);
            fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
        } else {
            logger.info("Not support this action when making order");
        }
    } else if (user_action === common.action_purchase) {
        sessionManager.setUserAction(session, common.set_quantity);
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_name);

    } else if (user_action === common.action_confirm_addr) {
        sessionManager.setUserAction(session, common.set_address);
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_email);

    } else if (user_action === common.action_retype_addr) {
        fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_enter_address);

    } else if (user_action === common.action_confirm_order) {
        sessionManager.setOrderStatusInfo(session, "confirm");
        gModelFactory.updateInvoice(session.last_invoice, function (invoice) {
            logger.info(invoice);
            fbMessenger.sendTextMessage(session.fbid, session.token, common.say_thank_buying, function () {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
            });
            sessionManager.resetSession(session);
        });

    } else if (user_action === common.action_cancel_order) {
        gModelFactory.cancelInvoice(session.last_invoice.id, "cancel", function (invoice) {
            if (invoice != null) {
                fbMessenger.sendTextMessage(session.fbid, session.token, common.pls_select_product);
                sessionManager.resetSession(session.fbid);
            }
        });
    } else {
        logger.error("Unknow action: " + JSON.stringify(action_details));
    }
}

function processEvent(event) {
    try {
        var sender = event.sender.id.toString();
        var receiver = event.recipient.id.toString();
        var pageInfo = gPagesInfo[receiver];
        var storeconfig = gStoreConfig[pageInfo.StoreId];
        
        if (pageInfo === undefined) {
            logger.error("::ProcessEvent():: Not support to handle the message from client to Page");
            return;
        }
        
        if ((storeconfig === undefined) || (storeconfig === null)) {
            logger.error("::ProcessEvent():: Can not load store config");
            return;
        }

        var currentSession = sessionManager.findOrCreateSession(pageInfo.StoreId, receiver, sender);
        currentSession.token = pageInfo.token;
        currentSession.storeUrl = pageInfo.Store.dataValues.home;

        var productInfo = sessionManager.getProductInfo(currentSession);
        //logger.info("store config = " + JSON.stringify(storeconfig));
        if (event.message) {
            if (event.message.text) {
                var text = event.message.text;
                var isURL = common.isUrl(text);
                var isOrdering = sessionManager.isOrdeTrigerStatusInfo(currentSession);
				var isTalkingWithStaff = sessionManager.isTalkingWithStaff(currentSession);
				
                logger.info("isURL = " + isURL);
                logger.info("isOrdering = " + isOrdering);
				logger.info("isTalkingWithStaff = " + isTalkingWithStaff);
                if (!isURL && !isOrdering && !isTalkingWithStaff) {
                    var options = {
                        storeid: currentSession.storeid,
                        pageid: receiver,
                        fbid: sender,
                        productid: productInfo.id,
                        codePattern: storeconfig.product_info.details.codepattern
                    };
                    intentParser.parse(text, options);
                } else if (isURL && !isOrdering){
                    searchProducts(currentSession, text, storeconfig);
                } else if (isTalkingWithStaff){
                    logger.info("Not execute NLP when user talking with Staff");					
				}else {
                    processTextEvent(currentSession, text, storeconfig);
                }
            } else if (event.message.attachments != null) {
                var attachments = event.message.attachments;
                // handle the case when user send an image for searching product
                for (var i = 0; i < attachments.length; i++) {
                    if (attachments[i].type === 'image') {
                        processTextEvent(currentSession, attachments[i].payload.url, storeconfig);
                    } else {
                        logger.info("Skipp to handle attachment");
                    }
                }
            }else{
                logger.info("Skip to handle text message: " + JSON.stringify(event.message));
            }
        } else if (event.postback) {
            var postback = JSON.parse(event.postback.payload);
            var delta = event.timestamp - currentSession.timestamp;
            logger.info("Delta Time = " + delta);
            if (delta > 300 /*avoid double click*/) {
                currentSession.timestamp = event.timestamp;
                processPostbackEvent(currentSession, postback);
                logger.info("session info: " + JSON.stringify(currentSession));
            } else {
                logger.info("Skipp to handle double click within delta = " + delta);
            }
        }else{
			logger.info("Not handle Event = " + JSON.stringify(event));
		}
    } catch (err) {
        logger.error("Error in handling message: " + err);
    }
    finally {
		logger.info("Finish handling an event from FB");
	}
}

//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//
function initWebHook() {
    Object.keys(gPagesInfo).forEach(function (key) {
        fbMessenger.doSubscribeRequest(gPagesInfo[key].token);
    });
    server.use(bodyParser.text({
            type: 'application/json'
        }));

    server.use(bodyParser.urlencoded({
            extended: true
        }));

    server.get(config.bots.fb_webhook, function (req, res) {
        logger.info("Get verification check = " + res);
        if (req.query['hub.verify_token'] === 'verify_me') {
            res.send(req.query['hub.challenge']);
            setTimeout(function () {
                Object.keys(gPagesInfo).forEach(function (key) {
                    fbMessenger.doSubscribeRequest(gPagesInfo[key].token);
                });
            }, 10000);
        } else {
            res.send('Error, wrong validation token');
        }
    });

    server.post(config.bots.fb_webhook, function (req, res) {
        try {
            var data = JSONbig.parse(req.body);
            var messaging_events = data.entry[0].messaging;
            for (var i = 0; i < messaging_events.length; i++) {
                var event = data.entry[0].messaging[i];
                processEvent(event);
            }
            return res.status(200).json({
                status: "ok"
            });
        } catch (err) {
            logger.error(err);
            return res.status(400).json({
                status: "error",
                error: err
            });
        }
    });

    server.listen(config.bots.port, function () {
        console.log('FB BOT ready to go!');
    });
}
//=====================================================================//
//================= FB webhook ========================================//
//=====================================================================//

module.exports = {
    enable_ai: function (use_ai) {
        gUseAIServiceFlag = useAIServiceFlag;
    },
    start: function () {
        if (gUseAIServiceFlag) {
            intentParser = parserFactory.createParser(ParserFactory.CONSTANT.AI_PARSER);
        } else {
            intentParser = parserFactory.createParser(ParserFactory.CONSTANT.REGEXP_PARSER);
        }
        setUpUserIntentListener();
        intentParser.setEmitter(emitter);
        gProductFinder.getAllStores(function (stores) {
            stores.forEach(function (store) {
                var name = store.home.replace("http://", "") + ".json";
                gStoreConfig[store.id] = common.loadStoreScrapingPattern(store.type, name);
                var storeSupport = common.loadJson("./datasets/support/" + name);
                gStoreSupport[store.id] = storeSupport;
            });
        });

        gProductFinder.getAllPages(function (pages) {
            pages.forEach(function (page) {
                gPagesInfo[page.pageId] = page;
                //fbMessenger.removeMenu(page.token);
                fbMessenger.showMenu(page.token);
                fbMessenger.sendTextMessage("617059095085957", 
                page.token,"Finished booting BOT Server");
            });
            initWebHook();
        });
    }

}
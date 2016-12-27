var common = require("../util/common");
var logger = require("../util/logger.js");
var config = require("../config/config.js");
var request = require('request');
var bodyParser = require('body-parser');
var lastMessageToSenders = [];

function FBMessenger() {
    this.sendDataToFBMessenger = function(sender, token, data, callback) {
        // if (lastMessageToSenders[sender] === undefined
        //     && lastMessageToSenders[sender] != data) {
        // Delay 500 ms for typing like human
        //setTimeout(function() {
        logger.info("Data = " + JSON.stringify(data));
        require('request')({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: token
            },
            method: 'POST',
            json: true,
            body: {
                recipient: {
                    id: sender
                },
                message: data
            },
        }, function(error, response, body) {
            if (error) {
                logger.error('Error sending message: ' + error.stack);
            } else if (response.body.error) {
                logger.error('Error: ' + JSON.stringify(response.body.error));
                } else {
                    logger.info("Send to FB response: " + JSON.stringify(body));
                }
            if (callback != null && common.isDefined(callback)) {
                callback();
            }
            // lastMessageToSenders[sender] = data;
        });
        //}, 1000);
        // } else {
        //     logger.info("Avoid sending same message");
        //     if (callback != null) {
        //         callback();
        //     }
        // }

    }

    this.createCategoryElement = function(id, name, link, cover) {
        var payload1 = {};
        payload1.id = id;
        payload1.title = name;
        payload1.action = common.action_view_category;
        var element = {
            "title": "Danh mục: " + name,
            "subtitle": "Nhấn nút bên dưới để xem danh sách sản phẩm trong danh mục",
            "image_url": cover+"_",
            "buttons": [{
                "type": "postback",
                "title": "Xem danh mục",
                "payload": JSON.stringify(payload1)
            }]
        };
        return element;
    }

    this.createProductElement = function(title, price, discount,
        thumbnail_url, link, code, id) {        
		var payload1 = {};
        payload1.id = id;
        payload1.title = title;
        payload1.action = common.action_view_details;
		
        var payload2 = {};
        payload2.id = id;
        payload2.title = title;
        payload2.action = common.action_show_similar;//common.action_order;
		
        var priceInfo = "";        
        logger.info("price = " + price);
        logger.info("discount = " + discount);        
        if (discount < price) {
            priceInfo = " - Giá KM: " + common.toCurrencyString(discount, " VNĐ");
            priceInfo += "\n - Giá Gốc: " + common.toCurrencyString(price, " VNĐ");
        } else {
            priceInfo = "Giá hiện tại: " + common.toCurrencyString(price, " VNĐ");
        }

        var element = {
            "title": title,
            "subtitle": priceInfo,
            "item_url": link+"_",
            "image_url": thumbnail_url + "_",
            "buttons": [
            {
                "type": "web_url",
                "url":link,
                "title":"Xem chi tiết",
                "webview_height_ratio": "tall"
            },
            // {
                // "type":"element_share",
                // "title": "Share"
            // },
            {
                "type": "postback",
                "title": "Sản phẩm tương tự",//"Chọn sản phẩm",
                "payload": JSON.stringify(payload2),
            }]
        };
        return element;
    }
    this.createProductPhotoElement = function(id, title, colorNsize, photo) {
        var payload2 = {};
        payload2.id = id;
        payload2.title = title;
        payload2.action = common.action_order;
        var element = {
            "title": title,
            "subtitle": colorNsize,
            "image_url": photo.link,
            "buttons": [{
                "type": "postback",
                "title": "Chọn sản phẩm",
                "payload": JSON.stringify(payload2),
            }]
        };
        return element;
    }

    this.createSearchOrPurchaseElement = function() {
        var purchase_action = {};
        var search_action = {};
        search_action.action = common.action_continue_search;
        purchase_action.action = common.action_purchase;
        var template = [{
            "type": "postback",
            "title": "Chọn sản phẩm khác",
            "payload": JSON.stringify(search_action),
        }, {
            "type": "postback",
            "title": "Mua hàng ngay",
            "payload": JSON.stringify(purchase_action),
        }];
        return template;
    }

    this.createConfirmOrCancelElement = function() {
        var confirm_action = {};
        var cancel_action = {};
        confirm_action.action = common.action_confirm_order;
        cancel_action.action = common.action_cancel_order;
        var template = [{
            "type": "postback",
            "title": "Hủy đặt hàng",
            "payload": JSON.stringify(cancel_action),
        }, {
            "type": "postback",
            "title": "Thêm SP khác",
            "payload": "Implemented later",
        }, {
            "type": "postback",
            "title": "Xác nhận",
            "payload": JSON.stringify(confirm_action),
        }];
        return template;
    }

    this.createAddressConfirmElement = function() {
        var confirm_action = {};
        var cancel_action = {};
        confirm_action.action = common.action_confirm_addr;
        cancel_action.action = common.action_retype_addr;
        var template = [{
            "type": "postback",
            "title": "Nhập lại",
            "payload": JSON.stringify(cancel_action),
        }, {
            "type": "postback",
            "title": "Xác nhận",
            "payload": JSON.stringify(confirm_action),
        }];
        return template;
    }

    this.createProductTypeConfirmElement = function(types) {
        var template = [];
        var confirm = {};
        confirm.action = common.action_confirm_type;
        var keys = Object.keys(types);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            confirm.type = key;
            var button = {
                "type": "postback",
                "title": types[key],
                "payload": JSON.stringify(confirm),
            }
            template.push(button);
        }
        return template;
    }
}

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
FBMessenger.prototype.showMenu = function(token){
    var data = {
      "setting_type" : "call_to_actions",
      "thread_state" : "existing_thread",
      "call_to_actions":[
        {
            "title":"Danh mục sản phẩm",
            "type":"postback",
            "payload":"{\"action\":\"view_categories\"}"
        },
        {
            "title":"Tìm kiếm với Chatbot",
            "type":"postback",
            "payload":"{\"action\":\"talk_bot\"}"
        },
		{
          "type":"postback",
          "title":"Gọi nhân viên tư vấn",
          "payload":"{\"action\":\"call_staff\"}"
        },
        {
          "type":"postback",
          "title":"Help",
           "payload":"{\"action\":\"view_help\"}"
        }
      ]
    };
    require('request')({
        url: 'https://graph.facebook.com/v2.6/me/thread_settings',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: true,
        body: data
    }, function(error, response, body) {
        if (error) {
            logger.error('Error sending message: ' + error.stack);
        } else if (response.body.error) {
            logger.error('Error: ' + JSON.stringify(response.body.error));
        } else {
            logger.info("Send to FB response: " + JSON.stringify(body));
        }
    });
}

FBMessenger.prototype.removeMenu = function(token){
    var data = {
      "setting_type" : "call_to_actions",
      "thread_state" : "existing_thread"
    };
    require('request')({
        url: 'https://graph.facebook.com/v2.6/me/thread_settings',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: true,
        body: data
    }, function(error, response, body) {
        if (error) {
            logger.error('Error sending message: ' + error.stack);
        } else if (response.body.error) {
            logger.error('Error: ' + JSON.stringify(response.body.error));
        } else {
            logger.info("Send to FB response: " + JSON.stringify(body));
        }
    });
}

FBMessenger.prototype.sendProductElements = function(sender, token, foundProducts) {
    var messageData = [];
    var productCount = (foundProducts.length > common.product_search_max) ?
        common.product_search_max : foundProducts.length;
    for (var i = 0; i < productCount; i++) {
        logger.info(JSON.stringify(foundProducts[i]))
        var productElement = this.createProductElement(
        foundProducts[i].title,
        foundProducts[i].price,
        foundProducts[i].discount,
        foundProducts[i].thumbnail.replaceAll("%%", "-"),
        foundProducts[i].link.replaceAll("%%", "-"),
        foundProducts[i].code,
        foundProducts[i].id);
        messageData.push(productElement);
    }
    this.sendGenericMessage(sender, token, messageData);
}

FBMessenger.prototype.sendLinkMessage = function(sender, token, message) {
    this.sendTextMessage(sender, token, message);
}

FBMessenger.prototype.sendProductTypeConfirm = function(sender, token, message, types) {
    var buttons = this.createProductTypeConfirmElement(types);
    this.sendConfirmMessage(sender, token, message, buttons);
}

FBMessenger.prototype.sendCategoriesElements = function(sender, token, foundCategories) {
    var messageData = [];
    var categoryCount = (foundCategories.length > common.product_search_max) ?
        common.product_search_max : foundCategories.length;
    for (var i = 0; i < categoryCount; i++) {
        if (foundCategories[i].cover != null) {
            var categoryElement = this.createCategoryElement(
                foundCategories[i].id,
                foundCategories[i].name,
                foundCategories[i].link,
                foundCategories[i].cover);
            messageData.push(categoryElement);
        }
    }
    if (messageData.length >= 2) {
        //this.sendTextMessage(sender, token, common.notify_product_search2);
    }
    this.sendGenericMessage(sender, token, messageData);
}

FBMessenger.prototype.sendProductPhotoElements = function(sender, token, id, title, colorNsize, photoLinks) {
    var photoElements = [];
    var length = (photoLinks.length > common.product_search_max) ? common.product_search_max : photoLinks.length;
    for (var i = 0; i < length; i++) {
        var photoElement = this.createProductPhotoElement(id, title, colorNsize, photoLinks[i]);
        photoElements.push(photoElement);
    }
    this.sendGenericMessage(sender, token, photoElements);
}

FBMessenger.prototype.createAIAPIProductsMessage = function(rich_data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    return {
        "speech": "Found products are",
        "displayText": "San pham tim thay",
        "data": {
            "facebook": messageData
        },
        "source": "joybox web service"
    }
}

FBMessenger.prototype.doSubscribeRequest = function(token) {
    request({
            method: 'POST',
            uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + token
        },
        function(error, response, body) {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}

FBMessenger.prototype.sendTextMessage = function(sender, token, simple_text, callback) {
    var messageData = {
        text: simple_text
    }
    console.log("Sender = " + sender + " message: " + simple_text);
    this.sendDataToFBMessenger(sender, token, messageData, callback);
}

FBMessenger.prototype.sendGenericMessage = function(sender, token, rich_data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    this.sendDataToFBMessenger(sender, token, messageData, null);
}

FBMessenger.prototype.sendPurchaseConfirmMessage = function(sender, token, message) {
    var buttons = this.createSearchOrPurchaseElement();
    this.sendConfirmMessage(sender, token, message, buttons);
}

FBMessenger.prototype.sendAddressConfirmMessage = function(sender, token, message) {
    var buttons = this.createAddressConfirmElement();
    this.sendConfirmMessage(sender, token, message, buttons);
}

FBMessenger.prototype.sendOrderConfirmMessage = function(sender, token, message) {
    var buttons = this.createConfirmOrCancelElement();
    this.sendConfirmMessage(sender, token, message, buttons);
}

FBMessenger.prototype.sendConfirmMessage = function(sender, token, message, buttons) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": message,
                "buttons": buttons
            }
        }
    };
    this.sendDataToFBMessenger(sender, token, messageData, null);
}

FBMessenger.prototype.createOrderItemElement = function(title, desc, price, quantity, thumbnail_url) {
    var jsonItem = {
        "title": title,
        "subtitle": desc,
        "quantity": quantity,
        "price": price,
        "currency": "VND",
        "image_url": thumbnail_url.replaceAll("%%", "-")
    };
    return jsonItem;
}

FBMessenger.prototype.generate_invoice_adjustment = function() {
    var adjustments = [{
        "name": "New Customer Discount",
        "amount": 20
    }, {
        "name": "$10 Off Coupon",
        "amount": 10
    }];

    return adjustments;
}

FBMessenger.prototype.sendReceiptMessage = function(sender, token, invoice_items, invoice_details,
    summary, adjustments, callback) {
    var fullAddress = {
        street_1: "",
        city: "",
        state: "",
        postal_code: "10000",
        country: "VN"
    };
    // Street, city, province, country
    var temp = invoice_details.address.split(",");
    switch (temp.length) {
        case 0:
        case 1:
            break;
        case 2:
            fullAddress.street_1 = temp[0].trim();
            fullAddress.city = temp[0].trim();
            fullAddress.state = temp[0].trim();
            break;
        case 3:
            fullAddress.street_1 = temp[0].trim();
            fullAddress.city = temp[1].trim();
            fullAddress.state = temp[1].trim();
            break;
        case 4:
            fullAddress.street_1 = temp[0].trim();
            fullAddress.city = temp[temp.length - 2].trim();
            fullAddress.state = temp[temp.length - 2].trim();
            break;
        default:
            for (var i = 0; i < (temp.length - 2); i++) {
                fullAddress.street_1 += temp[i].trim() + ", ";
            }
            logger.info("invoice_details.address = " + invoice_details.address);
            logger.info("fullAddress.street_1 = " + fullAddress.street_1);
            fullAddress.street_1 = fullAddress.street_1.slice(0, -2);
            fullAddress.city = temp[temp.length - 2].trim();
            fullAddress.state = temp[temp.length - 2].trim();
            break;
    }

    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "receipt",
                "order_number": invoice_details.id,
                "recipient_name": invoice_details.name + " - ĐT " + invoice_details.phone,
                "elements": invoice_items,
                "currency": "VND",
                "order_url": "",
                "timestamp": invoice_details.creation_date,
                "address": fullAddress,
                "payment_method": "COD",
                "summary": summary,
                "adjustments": adjustments
            }
        }
    }
    this.sendDataToFBMessenger(sender, token, messageData, callback);
}

FBMessenger.prototype.getUserProfile = function(fbid, callback) {
    const req = {
        method: 'GET',
        uri: `https://graph.facebook.com/v2.6/${fbid}`,
        qs: {
            fields: 'first_name,last_name,locale,gender',
            access_token: FB_PAGE_ACCESS_TOKEN
        },
        json: true
    }
    request(req, function(error, response, body) {
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


module.exports = FBMessenger;

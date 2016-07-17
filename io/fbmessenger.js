var common = require("../util/common");
var logger = require("../util/logger.js");
var config = require("../config/config.js");
var request = require('request');
var bodyParser = require('body-parser');

function FBMessenger() {
    this.sendDataToFBMessenger = function (sender, data, callback) {
        // Delay 500 ms for typing like human
        //setTimeout(function() {
        logger.info("Data = " + JSON.stringify(data));
        require('request')({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: config.bots.fb_page_token
            },
            method: 'POST',
            json: true,
            body: {
                recipient: {
                    id: sender
                },
                message: data
            }
        }, function (error, response, body) {
            if (error) {
                logger.error('Error sending message: ' + error.stack);
            } else if (response.body.error) {
                logger.error('Error: ' + JSON.stringify(response.body.error));
            } else {

            }
            if (callback != null) {
                callback();
            }
        });
        //}, 1000);
    }

    this.createCategoryElement = function (id, name, link, cover) {
        var payload1 = {};
        payload1.id = id;
        payload1.title = name;
        payload1.action = common.action_view_category;
        var element = {
            "title": "Danh mục: " + name,
            "subtitle": "Nhấn nút bên dưới để xem danh sách sản phẩm trong danh mục",
            "image_url": cover,
            "buttons": [{
                "type": "postback",
                "title": "Xem danh mục",
                "payload": JSON.stringify(payload1)
            }]
        };
        return element;
    }

    this.createProductElement = function (title, price, discount,
        thumbnail_url, link, code, id) {
        var payload1 = {};
        payload1.id = id;
        payload1.title = title;
        payload1.action = common.action_view_details;
        var payload2 = {};
        payload2.id = id;
        payload2.title = title;
        payload2.action = common.action_order;
        var priceInfo = "";
        if (discount < price) {
            priceInfo = " - Giá KM: " + common.toCurrencyString(discount, " VNĐ");
            priceInfo += "\n - Giá Gốc: " + common.toCurrencyString(price, " VNĐ");
        } else {
            priceInfo = "Giá hiện tại: " + common.toCurrencyString(price, " VNĐ");
        }
        var element = {
            "title": title,
            "subtitle": priceInfo,
            "item_url":link,
            "image_url": thumbnail_url,
            "buttons": [{
                "type": "postback",
                "title": "Nhấn xem Ảnh & Size",
                "payload": JSON.stringify(payload1)
            }, {
                    "type": "postback",
                    "title": "Chọn sản phẩm",
                    "payload": JSON.stringify(payload2),
                }]
        };
        return element;
    }
    this.createProductPhotoElement = function (id, title, colorNsize, photo) {
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

    this.createSearchOrPurchaseElement = function () {
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

    this.createConfirmOrCancelElement = function () {
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
                "title": "Xác nhận",
                "payload": JSON.stringify(confirm_action),
            }];
        return template;
    }

    this.createAddressConfirmElement = function () {
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

    this.createProductTypeConfirmElement = function (types) {
        var confirm = {};
        confirm.action = common.action_confirm_type;
        var template = [];
        for (var i = 0; i < types.length; i++) {
            confirm.type = types[i];
            var button = {
                "type": "postback",
                "title": types[i],
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
FBMessenger.prototype.sendProductElements = function (sender, foundProducts) {
    var messageData = [];
    var productCount = (foundProducts.length > common.product_search_max) ?
        common.product_search_max : foundProducts.length;
    for (var i = 0; i < productCount; i++) {
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
    this.sendGenericMessage(sender, messageData);
}
FBMessenger.prototype.sendProductTypeConfirm = function (sender, message, types) {
    var buttons = this.createProductTypeConfirmElement(types);
    this.sendConfirmMessage(sender, message, buttons);
}

FBMessenger.prototype.sendCategoriesElements = function (sender, foundCategories) {
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
        this.sendTextMessage(sender, common.notify_product_search2);
    }
    this.sendGenericMessage(sender, messageData);
}

FBMessenger.prototype.sendProductPhotoElements = function (sender, id, title, colorNsize, photoLinks) {
    var photoElements = [];
    var length = (photoLinks.length > common.product_search_max) ? common.product_search_max : photoLinks.length;
    for (var i = 0; i < length; i++) {
        var photoElement = this.createProductPhotoElement(id, title, colorNsize, photoLinks[i]);
        photoElements.push(photoElement);
    }
    this.sendGenericMessage(sender, photoElements);
}

FBMessenger.prototype.createAIAPIProductsMessage = function (rich_data) {
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

FBMessenger.prototype.doSubscribeRequest = function () {
    request({
        method: 'POST',
        uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + config.bots.fb_page_token
    },
        function (error, response, body) {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}

FBMessenger.prototype.sendTextMessage = function (sender, simple_text, callback) {
    var messageData = {
        text: simple_text
    }
    console.log("Sender = " + sender + " message: " + simple_text);
    this.sendDataToFBMessenger(sender, messageData, callback);
}

FBMessenger.prototype.sendGenericMessage = function (sender, rich_data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    this.sendDataToFBMessenger(sender, messageData, null);
}

FBMessenger.prototype.sendPurchaseConfirmMessage = function (sender, message) {
    var buttons = this.createSearchOrPurchaseElement();
    this.sendConfirmMessage(sender, message, buttons);
}

FBMessenger.prototype.sendAddressConfirmMessage = function (sender, message) {
    var buttons = this.createAddressConfirmElement();
    this.sendConfirmMessage(sender, message, buttons);
}

FBMessenger.prototype.sendOrderConfirmMessage = function (sender, message) {
    var buttons = this.createConfirmOrCancelElement();
    this.sendConfirmMessage(sender, message, buttons);
}

FBMessenger.prototype.sendConfirmMessage = function (sender, message, buttons) {
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
    this.sendDataToFBMessenger(sender, messageData, null);
}

FBMessenger.prototype.createOrderItemElement = function (title, desc, price, quantity, thumbnail_url) {
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

FBMessenger.prototype.generate_invoice_summary = function (sub_total, shipping_cost) {
    var summary = {
        "subtotal": sub_total,
        "shipping_cost": shipping_cost,
        "total_tax": sub_total * 0.05, // 5 % VAT
        "total_cost": (sub_total + shipping_cost + sub_total * 0.05)
    };

    return summary;
}

FBMessenger.prototype.generate_invoice_adjustment = function () {
    var adjustments = [{
        "name": "New Customer Discount",
        "amount": 20
    }, {
            "name": "$10 Off Coupon",
            "amount": 10
        }];

    return adjustments;
}

FBMessenger.prototype.sendReceiptMessage = function (sender, invoice_items, invoice_details,
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
    switch(temp.length){
        case 1:
        break;
        case 2:
            fullAddress.street_1 = "";
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
    this.sendDataToFBMessenger(sender, messageData, callback);
}

FBMessenger.prototype.getUserProfile = function (fbid, callback) {
    const req = {
        method: 'GET',
        uri: `https://graph.facebook.com/v2.6/${fbid}`,
        qs: {
            fields: 'first_name,last_name,locale,gender',
            access_token: FB_PAGE_ACCESS_TOKEN
        },
        json: true
    }
    request(req, function (error, response, body) {
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

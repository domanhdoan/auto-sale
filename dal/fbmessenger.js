
var common = require("../util/common");
var logger = require("../util/logger.js");
var config = require("../config/config.js");

function FBMessenger(){
    this.sendDataToFBMessenger = function (sender, data, callback) {
        logger.info("Data = " + JSON.stringify(data));
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: { access_token: config.bots.fb_page_token },
            method: 'POST',
            json: true,
            body: {
                recipient: { id: sender },
                message: data
            }
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
}

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
FBMessenger.prototype.createProductElement = function(title, price, thumbnail_url, link, code, id) {
    var payload1 = {};
    payload1.id = id;
    payload1.title = title;
    payload1.action = common.action_view_details;
    var payload2 = {};
    payload2.id = id;
    payload2.title = title;
    payload2.action = common.action_order;
    var element = {
        "title": title,
        "subtitle": price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " VNĐ",
        "image_url": thumbnail_url,
        "buttons": [
            {
                "type": "postback",
                "title": "Xem màu & size",
                "payload": JSON.stringify(payload1)
            },
            {
                "type": "postback",
                "title": "Cho vào giỏ hàng",
                "payload": JSON.stringify(payload2),
            },
            {
                "type": "web_url",
                "url": link,
                "title": "Xem trên Web"
            }]
    };
    return element;
}

FBMessenger.prototype.createSearchOrPurchaseElement = function() {
    var purchase_action = {};
    var search_action = {};
    search_action.action = common.action_continue_search;
    purchase_action.action = common.action_purchase;
    var template = [{
        "type": "postback",
        "title": "Thêm sản phẩm",
        "payload": JSON.stringify(search_action),
    },
        {
            "type": "postback",
            "title": "Mua hàng",
            "payload": JSON.stringify(purchase_action),
        }];
    return template;
}

FBMessenger.prototype.createConfirmOrCancelElement = function() {
    var confirm_action = {};
    var cancel_action = {};
    confirm_action.action = common.action_confirm_order;
    cancel_action.action = common.action_cancel_order;
    var template = [
        {
            "type": "postback",
            "title": "Hủy mua hàng",
            "payload": JSON.stringify(cancel_action),
        },
        {
            "type": "postback",
            "title": "Xác nhận",
            "payload": JSON.stringify(confirm_action),
        }
    ];
    return template;
}

FBMessenger.prototype.createAddressConfirmElement = function() {
    var confirm_action = {};
    var cancel_action = {};
    confirm_action.action = common.action_confirm_addr;
    cancel_action.action = common.action_retype_addr;
    var template = [
        {
            "type": "postback",
            "title": "Nhập lại",
            "payload": JSON.stringify(cancel_action),
        },
        {
            "type": "postback",
            "title": "Xác nhận",
            "payload": JSON.stringify(confirm_action),
        }
    ];
    return template;
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

FBMessenger.prototype.doSubscribeRequest = function() {
    request({
        method: 'POST',
        uri: "https://graph.facebook.com/v2.6/me/subscribed_apps?access_token=" + FB_PAGE_ACCESS_TOKEN
    },
        function (error, response, body) {
            if (error) {
                console.error('Error while subscription: ', error);
            } else {
                console.log('Subscription result: ', response.body);
            }
        });
}

FBMessenger.prototype.sendTextMessage = function(sender, simple_text, callback) {
    var messageData = {
        text: simple_text
    }
    console.log("Sender = " + sender + " message: " + simple_text);
    this.sendDataToFBMessenger(sender, messageData, callback);
}

FBMessenger.prototype.sendGenericMessage = function(sender, rich_data) {
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

FBMessenger.prototype.sendConfirmMessage = function(sender, message, buttons) {
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

FBMessenger.prototype.generate_invoice_summary = function(sub_total, shipping_cost) {
    var summary = {
        "subtotal": sub_total,
        "shipping_cost": shipping_cost,
        "total_tax": sub_total * 0.05, // 5 % VAT
        "total_cost": (sub_total + shipping_cost + sub_total * 0.05)
    };

    return summary;
}

FBMessenger.prototype.generate_invoice_adjustment = function() {
    var adjustments = [
        {
            "name": "New Customer Discount",
            "amount": 20
        },
        {
            "name": "$10 Off Coupon",
            "amount": 10
        }
    ];

    return adjustments;
}

FBMessenger.prototype.sendReceiptMessage = function(sender, invoice_items, invoice_details,
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
    fullAddress.street_1 = invoice_details.address.replace(","+ temp[temp.length - 2]
        + "," + temp[temp.length - 1], "");
    fullAddress.city = temp[temp.length - 2].trim();
    fullAddress.state = temp[temp.length - 2].trim();

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
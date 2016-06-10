var request = require('request');
var common = require("../util/common");

// =================================================================
// Methods for sending message to target user FB messager
// =================================================================

function createProductElement(title, price, thumbnail_url, link, code, id) {
    var payload = {};
    payload.id = id;
    payload.code = code;
    payload.action = "select";
    var template = {
        "title": title,
        "subtitle": price,
        "image_url": thumbnail_url,
        "buttons": [{
            "type": "web_url",
            "url": link,
            "title": "Chi tiết"
        },
            {
                "type": "postback",
                "title": "Đặt hàng",
                "payload": JSON.stringify(payload),
            }],
    };
    return template;
}

function createSearchOrPurchaseElement() {
    var order_action = {};
    var search_action = {};
    search_action.action = "search";
    order_action.action = "order";
    var template = [{
        "type": "postback",
        "title": "Thêm sản phẩm",
        "payload": JSON.stringify(search_action),
    },
        {
            "type": "postback",
            "title": "Đặt hàng",
            "payload": JSON.stringify(order_action),
        }];
    return template;
}

function sendDataToFBMessenger(sender, data) {
    logger.info("Data = " + JSON.stringify(data));

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: config.network.fb_page_token },
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
            //logger.info(response);
        }
    });
}

function sendTextMessage(sender, simple_text) {
    var messageData = {
        text: simple_text
    }
    console.log("Sender = " + sender);
    sendDataToFBMessenger(sender, messageData);
}

function sendGenericMessage(sender, rich_data) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": rich_data
            }
        }
    };
    sendDataToFBMessenger(sender, messageData);
}

function sendConfirmMessage(sender, buttons) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                "text": "Bạn muốn tiếp tục chọn thêm sản phẩm khác?",
                "buttons": buttons
            }
        }
    };
    sendDataToFBMessenger(sender, messageData);
}

function createOrderItemElement(title, desc, price, quantity, thumbnail_url) {
    var template = {
        "title": title,
        "subtitle": desc,
        "quantity": quantity,
        "price": price,
        "currency": "VND",
        "image_url": thumbnail_url
    };
    return template;
}

function sendReceiptMessage(sender, order_items, invoice_details) {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "receipt",
                "recipient_name": invoice_details.name,
                "order_number": invoice_details.id,
                "currency": "VND",
                "payment_method": "COD",
                "order_url": "",
                "timestamp": invoice_details.creation,
                "elements": order_items,
                "address": {
                    "street_1": "1 Hacker Way",
                    "street_2": "",
                    "city": "Menlo Park",
                    "postal_code": "94025",
                    "state": "CA",
                    "country": "US"
                },
                "summary": {
                    "subtotal": 75.00,
                    "shipping_cost": 4.95,
                    "total_tax": 6.19,
                    "total_cost": 56.14
                },
                "adjustments": [
                    {
                        "name": "New Customer Discount",
                        "amount": 20
                    },
                    {
                        "name": "$10 Off Coupon",
                        "amount": 10
                    }
                ]
            }
        }
    }
    sendDataToFBMessenger(sender, messageData);
}
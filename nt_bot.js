/*
 */
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');

var token = "EAANYeoVPMJcBAEc6wWojalF4prTtZAXNfAwit6Mr0awLGQh6LlTYoJNDoO21wZBGvc0wMEmSx0SVaVOFmlbRx1STBhwYT1jbHr0okvDfgsFOZB8KOWUE2ZCYpbvlZBHyDGtEVu6s1Tj3tRRiPvyIaXvk2YPpNRntZBPA50FHjFpAZDZD";

var helloMsg = "Xin chào";
var nameMsg = "Công ty cổ phần nghiên cứu và ứng dụng NT \n số 28 Ngách 33 Ngõ 102 \n Trường Chinh Đống Đa Hà Nội";
var contactMsg = "Tel : 0438642558 (ext: 103) \n Hotlines kinh doanh: 0938122116 \n Kỹ thuật: 01249988668";
var helpMsg = "gõ: \'liên hệ\' - thông tin liên hệ hỗ trợ đặt hàng, kỹ thuật \n \'sản phẩm\' - liệt kê danh sách sản phẩm \n \'địa chỉ' để hiện thông tin công ty";

// Define JSON File
console.log("\n READING DATABASE \n");
// Get content from file
var contents;
var url_product = "https://extraction.import.io/query/extractor/04ab5094-e84e-44f8-9aa4-0e4b8046c0e5?_apikey=4381281dee5e41c0aff498e90be30be48590f27542bfc56d49826c34e7237006e65225418af05cd3f7c0dd5ca4f53faf84a2cbcaf3cedc166e56cf7832424f372e6502f82f2a611d25cb5000f612022d&url=http%3A%2F%2Fzeisicmienbac.com%2Fsan-pham";
var url_dvr = "https://extraction.import.io/query/extractor/853cc0ce-2c4b-44ca-a3f8-958d334c2c0d?_apikey=4381281dee5e41c0aff498e90be30be48590f27542bfc56d49826c34e7237006e65225418af05cd3f7c0dd5ca4f53faf84a2cbcaf3cedc166e56cf7832424f372e6502f82f2a611d25cb5000f612022d&url=http%3A%2F%2Fzeisicmienbac.com%2Ftim-kiem%3Fq%3D%25C4%2591%25E1%25BA%25A7u%2Bghi";
var url_slbt = "https://extraction.import.io/query/extractor/8750898b-2d04-47bb-a406-aa3c207d0d30?_apikey=4381281dee5e41c0aff498e90be30be48590f27542bfc56d49826c34e7237006e65225418af05cd3f7c0dd5ca4f53faf84a2cbcaf3cedc166e56cf7832424f372e6502f82f2a611d25cb5000f612022d&url=http%3A%2F%2Fzeisicmienbac.com%2Ftim-kiem%3Fq%3Dslbt";

var jsonContent;
var numberOfProduct;
var fs = require("fs");
var loadFromFile = false;

request({
  url: url_slbt,
}, function (error, response, body) {
	 if (!error && response.statusCode === 200) {
    console.log("\n LOADED DATA FROM ONLINE");
    //console.log("body:", body);
    jsonContent = JSON.parse(body);
		  // total number of products -> using URL
    numberOfProduct = jsonContent.extractorData.data[0].group.length
    console.log("length: ", numberOfProduct);
    console.log(jsonContent);
  }
	 else {
    console.log("\n LOADING DATA FROM LOCAL");
    contents = fs.readFileSync("data.json");
    jsonContent = JSON.parse(contents);
    // total number of products -> using URL
    numberOfProduct = jsonContent.result.extractorData.data[0].group.length;
    loadFromFile = true;
	 }
	 console.log("\n LOAD DATA COMPLETED");
});

app.get('/hello/', function (req, res) {

  res.send('hello world');
  console.log('hello world');
});


app.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === 'verify_me') {
    res.send(req.query['hub.challenge']);
  }
  res.send('Error, wrong validation token');
});

app.post('/webhook/', function (req, res) {
  messaging_events = req.body.entry[0].messaging;
  for (i = 0; i < messaging_events.length; i++) {
    event = req.body.entry[0].messaging[i];
    sender = event.sender.id;
    if (event.message && event.message.text) {
      text = event.message.text;
      text = text.toLowerCase();
      //sendTextMessage(sender, "Text received, echo: "+ text.substring(0, 200));
      if (text === 'xin chào') {
        sendTextMessage(sender, helloMsg);
        break;
      }

      else if (text === 'địa chỉ') {

        sendTextMessage(sender, nameMsg);
        break;
      }
      else if (text === 'liên hệ') {

        sendTextMessage(sender, contactMsg);
        break;
      }
      else if (text === 'sản phẩm') {
        sendGenericMessage(sender);
        break;
      }

      else if (text === 'trợ giúp') {
        sendTextMessage(sender, helpMsg);
        break;
      }

      else {
        sendTextMessage(sender, "gõ \'trợ giúp\' để được giúp đỡ");
        break;
      }
    }
  }
  res.sendStatus(200);
});

app.use(bodyParser.json());
app.listen(80, function(){
  console.log("Ready to go");
});

function sendTextMessage(sender, text) {
  messageData = {
    text: text
  }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: token },
    method: 'POST',
    json: {
      recipient: { id: sender },
      message: messageData,
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

// total number of products
//var numberOfProduct = jsonContent.result.extractorData.data[0].group.length

function sendGenericMessage(sender) {

  messageData = {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [],
      }
    }
  };
  for (i = 0; i < 5; i++) {

    //item = jsonContent.result.extractorData.data[0].group[i];	

    // Ussing url
    item = jsonContent.extractorData.data[0].group[i];

    var newElement = {
      "title": "",
      "subtitle": "",
      "image_url": "",
      "buttons": [{
        "type": "",
        "url": "",
        "title": ""
      }, {
          "type": "",
          "title": "",
          "payload": "",
        }],
    };

    //console.log("item", item);

    newElement.title = item["Listcontent link"][0].text;
    newElement.subtitle = "Giá bán: " + item["Pricetext value"][0].text;
    newElement.image_url = item["Listcontent image"][0].src;
    newElement.buttons[0].type = "web_url";
    newElement.buttons[0].url = item["Listcontent link"][0].href;
    newElement.buttons[0].title = "Web link";

    newElement.buttons[1].type = "postback";
    newElement.buttons[1].title = "Bookmark item";
    newElement.buttons[1].payload = "payload";

    messageData.attachment.payload.elements.push(newElement);

  }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: token },
    method: 'POST',
    json: {
      recipient: { id: sender },
      message: messageData,
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}
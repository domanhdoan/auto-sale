require('string.prototype.startswith');
var analyzer = require("./proccessor/web_crawler.js");
// var url = "http://giaynam.com/giay-buoc-day/";
// var url = "http://zeisicmienbac.com";
// var url = "https://bibomart.com.vn";
var url = "http://bluewind.vn";
var product_pattern = "";

var orm_manager = require("./db_management/db_manager.js");
var request = require("request");

request(url, function (error, response, body) {
	if (error) {
		console.log( "Couldn’t get page because of error: " + error);
		return;
	}
	//orm_manager.init();
	console.log(url + "\n");
	// Get pattern template for extracting
	product_pattern = url;
	if(product_pattern.startsWith('http://')){
		product_pattern = product_pattern.replace('http://', '');
	}else if(product_pattern.startsWith('https://')){
		product_pattern = product_pattern.replace('https://', '');
	}else{
		
	}
	product_pattern = './pattern/' + product_pattern + ".json";
	analyzer.extract_content(url, body, product_pattern, orm_manager);
});
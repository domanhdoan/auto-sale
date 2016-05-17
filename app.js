// var link_crawler = require("js-crawler");
var analyzer = require("./proccessor/crawler.js");
// var url = "http://giaynam.com/giay-buoc-day/";
// var product_pattern	= "./pattern/giaytot.json";
var url = "http://zeisicmienbac.com/san-pham";
var product_pattern	= "./pattern/zesiccamera.json";
// var url = "https://bibomart.com.vn";
// var product_pattern = "./pattern/bibomart.json";
var orm_manager = require("./db_management/db_manager.js");
var request = require("request");

request(url, function (error, response, body) {
	if (error) {
		console.log( "Couldn’t get page because of error: " + error);
		return;
	}
	//orm_manager.init();
	console.log(url + "\n");
	analyzer.extract_webcontent(url, body, product_pattern, orm_manager);
	
});
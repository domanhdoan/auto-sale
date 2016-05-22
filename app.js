require('string.prototype.startswith');
var crawler 		= require("./proccessor/web_crawler");
var auto_order_bot 	= require("./proccessor/customer_service_bot");
var common 			= require("./util/common");
// var url = "http://giaynam.com/giay-buoc-day/";
// var url = "http://zeisicmienbac.com";
// var url = "https://bibomart.com.vn";
var url = "http://bluewind.vn";
var product_pattern = "";
var models 		= require("./models/db_manager.js");

var product_pattern = common.load_crawl_pattern(url);
crawler.init(product_pattern, models);
crawler.crawl_alink_withdepth(url);
//auto_order_bot.set_crawler(crawler);
//auto_order_bot.init(8000, url + '' + product_pattern.product_search);

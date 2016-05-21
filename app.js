require('string.prototype.startswith');
var crawler 		= require("./proccessor/web_crawler.js");
var auto_order_bot 	= require("./proccessor/customer_service_bot.js");
var orm_manager 	= require("./db_management/db_manager.js");
var common 			= require("./util/common.js");
// var url = "http://giaynam.com/giay-buoc-day/";
// var url = "http://zeisicmienbac.com";
// var url = "https://bibomart.com.vn";
var url = "http://bluewind.vn";
var product_pattern = "";

var product_pattern = common.load_crawl_pattern(url);
orm_manager.init();
crawler.init(product_pattern, orm_manager);
//crawler.crawl_alink_indepth(url);
auto_order_bot.set_crawler(crawler);

auto_order_bot.init(8000, url + '' + product_pattern.product_search);

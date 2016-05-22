require('string.prototype.startswith');
var crawler = require("./proccessor/web_crawler");
var auto_order_bot = require("./proccessor/customer_service_bot");
var orm_manager = require("./models/db_manager.js");
var g_products_finder = require('./proccessor/product_search_engine.js');
var common = require("./util/common");
var url = "http://giaynam.com";
//var url = "http://zeisicmienbac.com";
// var url = "https://bibomart.com.vn";
// var url = "http://bluewind.vn";
var product_pattern = "";

var product_pattern = common.load_crawl_pattern(url);
crawler.init(product_pattern, orm_manager);
crawler.crawl_alink_withdepth(url);
g_products_finder.init(orm_manager);
//auto_order_bot.start(8000, url + '' + product_pattern.product_search, g_products_finder);

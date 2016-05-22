require('string.prototype.startswith');
var crawler = require("./proccessor/web_crawler");
var auto_order_bot = require("./proccessor/customer_service_bot");
var orm_manager = require("./models/db_manager.js");
var g_products_finder = require('./proccessor/product_search_engine.js');
var common = require("./util/common");
var logger = require("./util/logger");

var crawl_source = common.load_json("./crawl_sources/links.json");
if (crawl_source != null) {
    crawl_source.links.forEach(function (link) {
        var product_pattern = common.load_crawl_pattern(link);
        crawler.init(product_pattern, orm_manager);
        crawler.crawl_alink_withdepth(link);
    })
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}
g_products_finder.init(orm_manager);
//auto_order_bot.start(8000, url + '' + product_pattern.product_search, g_products_finder);

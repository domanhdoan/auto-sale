require('string.prototype.startswith');
var crawler         = require("./proccessor/web_crawler");
var auto_order_bot  = require("./proccessor/saleman_bot");
var product_finder  = require('./proccessor/product_finder.js');
var orm_manager     = require("./models/db_manager.js");
var common = require("./util/common");
var logger = require("./util/logger");

product_finder.init(orm_manager, crawler);

var crawl_source = common.load_json("./crawl_sources/links.json");
if (crawl_source != null) {
    crawl_source.links.forEach(function (link) {
        var product_pattern = common.load_crawl_pattern(link);
        crawler.init(product_pattern, orm_manager);
        //crawler.crawl_alink_withdepth(link);
        auto_order_bot.start(8080, link + '' + product_pattern.product_search, product_finder);
    })
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}

//g_products_finder.findProductsByImage('./6305.png');
//common.get_img_fingerprint('./6305.png', 'http://images.google.com/searchbyimage/upload', null);


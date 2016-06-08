var crawler = require("./proccessor/web_crawler");
var auto_order_bot = require("./proccessor/shoes_saleman_fbbot");
var product_finder = require('./proccessor/product_finder.js');
var common = require("./util/common");
var logger = require("./util/logger");
var orm_manager = require("./models/db_manager.js");
var model_factory = require("./models/model_factory.js");

require('string.prototype.startswith');

var mkdirp = require('mkdirp');
mkdirp('./temp', function(err) { 
    // path exists unless there was an error
    logger.info("Created temp folder successfully");
});

product_finder.init(orm_manager, crawler);
model_factory.init(orm_manager);

var crawl_source = common.load_json("./crawl_sources/links.json");
if (crawl_source != null) {
    crawl_source.links.forEach(function (link) {
        var product_pattern = common.load_crawl_pattern(link);
        //crawler.init(product_pattern, orm_manager);
        //crawler.crawl_alink_withdepth(link);
        auto_order_bot.start(5000, link, product_pattern.product_search, product_finder, model_factory);
    });
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}

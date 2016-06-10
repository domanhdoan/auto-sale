require('string.prototype.startswith');
var mkdirp = require('mkdirp');

var crawler = require("./controllers/web_crawler");
var shoes_salebot = require("./controllers/shoes_saleman_fbbot_aiapi");
var product_finder = require('./controllers/product_finder.js');
var common = require("./util/common");
var logger = require("./util/logger");
var orm_manager = require("./models/db_manager.js");
var model_factory = require("./models/model_factory.js");
var config = require("./config/config.js");

mkdirp(config.crawler.temp_dir, function (err) {
    // path exists unless there was an error
    logger.info("Created temp folder successfully");
});

product_finder.init(orm_manager, crawler);
model_factory.init(orm_manager);

var crawl_source = common.load_json("./crawl_sources/links.json");
if (crawl_source != null) {
    crawl_source.links.forEach(function (link) {
        var product_pattern = common.load_crawl_pattern(link);
        if(config.submodule.crawler){
            crawler.init(product_pattern, orm_manager);
            crawler.crawl_alink_withdepth(link);
        }

        if(config.submodule.salebot){
            shoes_salebot.start(config.network.port, link, 
                product_pattern.product_code_pattern, product_finder, model_factory);
        }
    });
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}
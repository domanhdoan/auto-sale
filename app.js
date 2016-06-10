require('string.prototype.startswith');
var mkdirp = require('mkdirp');

var crawler = require("./proccessor/web_crawler");
var auto_order_bot = require("./proccessor/shoes_saleman_fbbot");
var product_finder = require('./proccessor/product_finder.js');
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
            auto_order_bot.start(config.network.port, link, 
                product_pattern.product_code_pattern, product_finder, model_factory);
        }
    });
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}

// var url = "https://fbcdn-photos-d-a.akamaihd.net/hphotos-ak-xlp1/v/t34.0-0/p206x206/13413800_256494738048335_1923798606_n.jpg?_nc_ad=z-m&oh=cc3c654f9c45f265055410e9d4239a1a&oe=575D22BF&__gda__=1465670762_b78c51c19f34b830df45462c1fa8c42c";
// common.generate_remoteimg_hash(url, function(hash){
//     logger.info(hash);
// });
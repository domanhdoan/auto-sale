var crawler = require("./proccessor/web_crawler");
var auto_order_bot = require("./proccessor/saleman_fbbot");
var product_finder = require('./proccessor/product_finder.js');
var common = require("./util/common");
var logger = require("./util/logger");
var orm_manager = require("./models/db_manager.js");
require('string.prototype.startswith');

var mkdirp = require('mkdirp');
mkdirp('./temp', function(err) { 
    // path exists unless there was an error
    logger.info("Created temp folder successfully");
});

product_finder.init(orm_manager, crawler);

var crawl_source = common.load_json("./crawl_sources/links.json");
if (crawl_source != null) {
    crawl_source.links.forEach(function (link) {
        var product_pattern = common.load_crawl_pattern(link);
        crawler.init(product_pattern, orm_manager);
        // crawler.crawl_alink_withdepth(link);
        auto_order_bot.start(8080, link, product_pattern.product_search, product_finder);
    });
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}

// var phone = require('phone');
// var vn_phone = phone('+849775160566', 'VNM');
// console.log(vn_phone);

// common.generate_localimg_hash('./3101.jpg', function(hash){
//     product_finder.findProductByFinger(hash, function(product){
        
//     });
// });

// common.generate_remoteimg_hash("http://bluewind.vn/wp-content/uploads/2016/05/6305.png", 
//     function(hash){
// });

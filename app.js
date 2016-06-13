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


var args = process.argv.slice(2);
if(args.length > 0){
    for(var i = 0; i < args.length; i++){
        logger.info("Option = " + args[i]);
        if(args[i] === '-c'){
            config.submodule.crawler = true;
        } else if(args[i] === '-b'){
            config.submodule.salebot = true;
        }else{
            logger.error("Unknown options: " + args[i]);
        }
    }
}else{
    logger.error("Command: node app.js options");
    logger.error("Where options: ");
    logger.error("-c: turn on crawling. Default disable");
    logger.error("-b: turn on sale bot. Default disable");
    exit(0);
}

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
            shoes_salebot.start(link, product_pattern.product_code_pattern,
                product_finder, model_factory);
        }
    });
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}
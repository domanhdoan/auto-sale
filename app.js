require('string.prototype.startswith');
var mkdirp = require('mkdirp');

var config = require("./config/config.js");

var orm_manager = require("./models/db_manager.js");

var product_finder = require('./dal/product_finder.js');
var model_factory = require("./dal/model_factory.js");

var crawler         = require("./controllers/web_crawler");
var shoes_salebot   = require("./controllers/shoes_saleman_fbbot_aiapi");

var common = require("./util/common");
var logger = require("./util/logger");

function show_error() {
    logger.error("Command: node app.js options");
    logger.error("Where options: ");
    logger.error("-c: turn on crawling. Default disable");
    logger.error("-b: turn on sale bot. Default disable");
    logger.error("--noai: turn off sale bot. Default enable");
}

var args = process.argv.slice(2);
if (args.length > 0) {
    for (var i = 0; i < args.length; i++) {
        logger.info("Option = " + args[i]);
        if (args[i] === '-c') {
            config.submodule.crawler = true;
        } else if (args[i] === '-b') {
            config.submodule.salebot = true;
        } else if (args[i] === '--noai') {
            config.bots.ai_on = false;
        } else {
            logger.error("Unknown options: " + args[i]);
            show_error();
        }
    }
} else {
    show_error();
    exit(0);
}

mkdirp(config.crawler.temp_dir, function (err) {
    logger.info("Created temp folder successfully");
});

product_finder.init(orm_manager, crawler);
model_factory.init(orm_manager);
var store_crawling_pattern;
var crawl_source = common.load_json("./crawl_sources/links.json");
if (crawl_source != null) {
    crawl_source.links.forEach(function (link) {
        store_crawling_pattern = common.load_crawl_pattern(link);
        if (config.submodule.crawler) {
            crawler.init(store_crawling_pattern, orm_manager);
            crawler.crawlWholeSite(link);
        }

    });

    if (config.submodule.salebot) {
        shoes_salebot.enable_ai(config.bots.ai_on);
        shoes_salebot.start(link, store_crawling_pattern,
            product_finder, model_factory);
    }
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}
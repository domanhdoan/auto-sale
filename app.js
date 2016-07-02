require('string.prototype.startswith');
var mkdirp = require('mkdirp');

var config = require("./config/config.js");
var common = require("./util/common");
var logger = require("./util/logger");

var scraper = require("./processors/web_scraping_light");
var shoes_salebot = require("./controllers/shoes_salebot");


function show_error() {
    logger.error("Command: node app.js options");
    logger.error("Where options: ");
    logger.error("-c: turn on crawling. Default disable");
    logger.error("-b: turn on sale bot. Default disable");
    logger.error("--noai: turn off using AI for processing use message. Default disable");
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

mkdirp(config.crawler.temp_dir, function(err) {
    logger.info("Created temp folder successfully");
});

var store_config = [];
var crawl_source = common.loadJson("./crawl_sources/links.json");
if (crawl_source != null) {
    for (var i = 0, length = crawl_source.links.length; i < length; i++) {
        var link = crawl_source.links[i];
        store_config[i] = common.loadStoreConfig(link);
    }

    if (config.submodule.crawler) {
        for (var i = 0, length = store_config.length; i < length; i++) {
            scraper.crawlWholeSite(link, store_config[i], function() {});
        }
    }

    if (config.submodule.salebot) {
        shoes_salebot.enable_ai(config.bots.ai_on);
        shoes_salebot.start(crawl_source.links[0], store_config[0]);
    }
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}
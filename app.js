require('string.prototype.startswith');
var mkdirp = require('mkdirp');
var fs = require('fs');
var schedule = require('node-schedule');

var config = require("./config/config.js");
var common = require("./util/common");
var logger = require("./util/logger");

var WebScraper = require("./processors/web_scraping");

var fbWebhook = require("./controllers/fbwebhook");

function show_error() {
    logger.error("Command: node app.js options");
    logger.error("Where options: ");
    logger.error("-c: turn on crawling. Default disable");
    logger.error("-b: turn on sale bot. Default disable");
    logger.error("--noai: turn off using AI for processing use message. Default disable");
}

/*
var code1 = common.extractProductCode("Giày nam cổ lửng Sanvado da trơn màu da bò (KT-689))", "[A-Z]{1,3}-[0-9]{3,4}-[A-Z]{1,3}|[A-Z]{1,3}-[0-9]{3,4}|[0-9]{3,4}");
var code2 = common.extractProductCode("Giày da lộn cổ cao màu xanh rêu (LV-2203)", "[A-Z]{1,3}-[0-9]{3,4}-[A-Z]{1,3}|[A-Z]{1,3}-[0-9]{3,4}|[0-9]{3,4}");
var code3 = common.extractProductCode("(2203)", "[A-Z]{1,3}-[0-9]{3,4}-[A-Z]{1,3}|[A-Z]{1,3}-[0-9]{3,4}|[0-9]{3,4}");
var code4 = common.extractProductCode("Giày buộc dây công sở Sanvado đế cao da trơn màu nâu (PC-129-DC)", "[A-Z]{1,3}-[0-9]{3,4}-[A-Z]{1,3}|[A-Z]{1,3}-[0-9]{3,4}|[0-9]{3,4}");
var code5 = common.extractProductCode("(203)", "[A-Z]{1,3}-[0-9]{3,4}-[A-Z]{1,3}|[A-Z]{1,3}-[0-9]{3,4}|[0-9]{3,4}");
logger.info(code1.code);
logger.info(code2.code);
logger.info(code3.code);
logger.info(code4.code);
logger.info(code5.code);
*/
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
}

mkdirp(config.crawler.temp_dir, function(err) {
    logger.info("Created temp folder successfully");
});

var store_config = [];
var crawl_sources = fs.readdirSync("./datasets/shoes");

function runWebScrapingAsSchedule(datetime) {
    var store_config = [];
    var rule = new schedule.RecurrenceRule();
    rule.dayOfWeek = [0, new schedule.Range(0, 7)];
    rule.hour = 0;
    rule.minute = 2;
    var j = schedule.scheduleJob(rule, function() {
        console.log('The answer to life, the universe, and everything!');
        for (var i = 0, length = crawl_sources.length; i < length; i++) {
            var link = crawl_sources[i];
            store_config[i] = common.loadStoreScrapingPattern("shoes", link);
            scraper = new WebScraper(store_config[i]);
            scraper.crawlWholeSite(function() {});
        }
    });
    return store_config;
}

if (crawl_sources != null) {
    if (config.submodule.crawler) {
        for (var i = 0, length = crawl_sources.length; i < length; i++) {
            var link = crawl_sources[i];
            var storeConfig = common.loadStoreScrapingPattern("shoes", link);
            scraper = new WebScraper(storeConfig);
            scraper.crawlWholeSite(function() {});
        }
    }
    runWebScrapingAsSchedule();
} else {
    logger.error("Can not load json from " + "./crawl_sources/links.json");
}

if (config.submodule.salebot) {
   fbWebhook.start();
}
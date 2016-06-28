require('string.prototype.startswith');
var logger = require("../util/logger.js");
var common = require("../util/common.js");

var cheerio = require("cheerio");
var request = require("request");
var curHomepage = "";
var async = require('async');

var gCrawlPattern = null;
var gDbManager = require("../models/db_manager.js");
var gModelFactory = require("../dal/model_factory.js");

function handleNextPages(page_object, saved_store, saved_category,
    product_pattern) {
    var $ = page_object;
    // Extract data from remain pages
    var page_list = $(product_pattern.product_paging.page_link);
    if (page_list.length > 0) {
        page_list.each(function(i, page) {
            var link = $(this).attr('href');
            link = common.insertRootLink(link, curHomepage);
            var products = extractProductsForOneCategory(saved_store, saved_category,
                link, false);
        });
    } else {
        logger.info("ONLY have ONE page");
    }
}

function extractProductDetails(productPattern, savedProduct, savedStore) {
    request(savedProduct.link.replaceAll("%%", "-"), function(error, response, body) {
        if (error) {
            logger.error("Couldn’t get page " + savedProduct.link + " because of error: " + error);
            return;
        }
        var $ = cheerio.load(body);
        var detailLink = response.request.href;

        var sizeList = $(productPattern.details.size);
        var colorList = $(productPattern.details.color);
        var productPhotos = $(productPattern.details.photo);


        async.eachSeries(sizeList, function(size, callback) {
            var value = $(size).text().trim();
            var instock = $(size).find(productPattern.details.instock);
            if (instock.length > 0) {
                console.log("Size out of stock = " + instock.text().trim());
            } else {
                gModelFactory.findAndCreateProductSize(savedProduct, value,
                    function(size) {
                        callback();
                    });
            }
        }, function alert(err) {
            logger.info("err = " + err);
        });

        async.eachSeries(colorList, function(color, callback) {
            var name = $(color).text().trim();
            var value = $(color).text().trim();
            gModelFactory.findAndCreateProductColor(savedProduct,
                name, value,
                function(color) {
                    callback();
                });
        }, function alert(err) {
            logger.info("err = " + err);
        });

        async.eachSeries(productPhotos, function(photo, callback) {
            var link = $(photo).attr('href');
            gModelFactory.findAndCreateProductPhoto(savedStore, savedProduct,
                link, 0 /*false*/ ,
                function() {
                    callback();
                });
        }, function alert(err) {
            logger.info("err = " + err);
        });

        var code = $(productPattern.details.code);
        savedProduct.updateAttributes({
            code: code.text().trim()
        });
    });
}

function extractProductsForOneCategory(savedStore, savedCategory, handlePaging, callback) {
    var productlist = [];
    var link = savedCategory.dataValues.link;
    logger.info("Sub-category: " + link);
    request(link, function(error, response, body) {
        if (error) {
            logger.error("Couldn’t get page " + link + " because of error: " + error);
            return;
        }

        var $ = cheerio.load(body);

        // common.saveToFile(response.request.href, body);

        var productPattern = gCrawlPattern.product_info;
        var productList = $(productPattern.product_list);

        //for (var i = 0, len = product_list.length; i < len; i++) {
        async.each(productList, function(productElememt, callback) {
            var title = $(productElememt).find(productPattern.title).text();
            var thumbnailLink = $(productElememt).find(productPattern.thumbnail).attr('src');
            var desc = $(productElememt).find(productPattern.desc).text();

            if (thumbnailLink != undefined && thumbnailLink != "" && title != "") {
                var detailLink = $(productElememt).find(productPattern.detail_link).attr('href');
                detailLink = common.insertRootLink(detailLink, curHomepage);
                thumbnailLink = common.insertRootLink(thumbnailLink, curHomepage)

                common.saveToFile("./temp/product_links_save.txt", detailLink);

                if (desc == "") {
                    desc = title;
                }

                var priceStr = $(productElememt).find(productPattern.price).text();
                var discountStr = $(productElememt).find(productPattern.discount).text();
                var percent = $(productElememt).find(productPattern.percent).text();

                if (priceStr == null || priceStr == "") {
                    priceStr = discountStr;
                }

                if (discountStr == null || discountStr == "") {
                    discountStr = "0";
                }

                if (percent == null || percent == "") {
                    percent = "0";
                }
                var price = common.extractValue(priceStr.replaceAll(',', ''), "\\d+");
                var discount = common.extractValue(priceStr.replaceAll(',', ''), "\\d+");

                if (price > 0) {
                    gModelFactory.findAndCreateProduct(
                        savedStore, savedCategory,
                        title, thumbnailLink,
                        desc, price,
                        discount, percent,
                        detailLink, "",
                        gCrawlPattern.product_code_pattern,
                        function(savedProduct) {
                            extractProductDetails(productPattern, savedProduct, savedStore);
                        });
                } else if (price == 0) {
                    logger.info("Not save product which not have price\n");
                }
            } else {
                logger.info("Skipped this HTML element\n");
            }
        });

        if (handlePaging) {
            handleNextPages($, savedStore, savedCategory, productPattern);
        }

        if (callback != null) {
            callback();
        }
    });
    return productlist;
}

function extractCategories(home_page_object, savedStore, callback) {
    var $ = home_page_object;
    var menuItems = $(gCrawlPattern.product_menu.item);
    logger.info("Store: " + savedStore.dataValues.home);
    for (var i = 0, len = menuItems.length; i < len; i++) {
        var item = $(menuItems[i]).find(gCrawlPattern
            .product_menu.item_link);
        var category = item.text();
        if (menuItems[i].children.length == 1) {
            logger.info("Category: " + category);
            var item_link = item.attr("href");
            item_link = common.insertRootLink(item_link, curHomepage);
            gModelFactory.findAndCreateCategory(savedStore, category, item_link,
                function(savedCategory) {
                    extractProductsForOneCategory(savedStore, savedCategory, true, callback);
                });
        } else {
            logger.info("Will not extract product list for menu items that contain sub-menu");
        }
    }
}

exports.crawlWholeSite = function(home_page, crawl_pattern, callback) {
    gCrawlPattern = crawl_pattern;
    curHomepage = home_page;
    if (curHomepage != null && !curHomepage.startsWith('http')) {
        curHomepage = "http://" + curHomepage;
    }
    var existing_store = gModelFactory.findAndCreateStore(curHomepage,
        gCrawlPattern.store_type,
        function(store) {
            request(store.dataValues.home, function(error, response, body) {
                var web_content = body;
                if (error) {
                    logger.error("Couldn’t get page because of error: " + error);
                    return;
                }
                // load the web_content of the page into Cheerio so we can traverse the DOM
                var $ = cheerio.load(web_content);
                extractCategories($, store, callback);
                // common.saveToFile(response.request.href, web_content);
            });
        });
}

exports.extractThumbUrl = function(home_page, input_thumb, callback) {
    var encoded_uri = encodeURIComponent(input_thumb);
    var goole_search_image = "https://www.google.com/searchbyimage?&image_url="
    goole_search_image += encoded_uri + "&as_sitesearch=" + home_page;
    //    request.debug = true;
    request(goole_search_image, {
        followRedirect: true,
    }, function(error, response, body) {
        var options = {
            url: response.req._headers.referer + "&as_sitesearch=" + home_page,
            headers: {
                followRedirect: true,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36'
            }
        };

        request(options, function(error, response, body) {
            var $ = cheerio.load(body);
            var search_items = $('div.srg div.g div.rc div.s div div.th._lyb a');
            // var similar_images_link = "http://google.com" + $('div#rso div.g div._Icb._kk._wI a').attr('href');
            var image_url = "";
            if (search_items.length > 0) {
                var search_item = search_items[0];
                var url = $(search_item).attr('href').replaceAll("/imgres?", "");
                var params = url.split('&');
                image_url = params[0].replaceAll("imgurl=", "");
                var refurl = params[1].replaceAll("imgrefurl=", "");
                logger.info(image_url);
                callback(image_url)
            }
        });
    });
}
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

Array.prototype.unique = function() {
    return this.filter(function(value, index, array) {
        return array.indexOf(value, index + 1) < 0;
    });
};

function insertLinksWithoutDuplication(source, destination) {
    for (var i = 0, length = source.length; i < length; i++) {
        if (destination.indexOf(source[i]) < 0) {
            destination.push(source[i]);
        } else {
            logger.info("NOt insert due to duplication: " + source[i]);
        }
    }
    return destination;
}

function insertLinkWithoutDuplication(link, destination) {
    if (destination.indexOf(link) < 0) {
        destination.push(link);
        common.saveToFile("links.txt", "PASS - " + link);
    } else {
        logger.info("Duplication: " + link);
        common.saveToFile("links.txt", "DUP - " + link);

    }
}

function extractProductDetails(link, productPattern, savedStore) {
    request(link, function(error, response, body) {
        var $ = cheerio.load(body);
        var detailLink = response.request.href;

        var sizeList = $(productPattern.details.size);
        var colorList = $(productPattern.details.color);
        var productPhotos = $(productPattern.details.photo);

        var title = $(productElememt).find(productPattern.title).text();
        var thumbnailLink = $(productElememt).find(productPattern.thumbnail).attr('src');
        var desc = $(productElememt).find(productPattern.desc).text();

        if (thumbnailLink != undefined && thumbnailLink != "" && title != "") {
            var detailLink = $(productElememt).find(productPattern.detail_link).attr('href');
            detailLink = common.insertRootLink(detailLink, curHomepage);
            thumbnailLink = common.insertRootLink(thumbnailLink, curHomepage)

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

            var code = $(productPattern.details.code);

            if (price > 0) {
                gModelFactory.findAndCreateProduct(
                    savedStore, savedCategory,
                    title, thumbnailLink,
                    desc, price,
                    discount, percent,
                    detailLink, "",
                    gCrawlPattern.product_code_pattern,
                    function(savedProduct) {
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
                    });
            } else if (price == 0) {
                logger.info("Not save product which not have price\n");
            }
        } else {
            logger.info("Skipped this HTML element\n");
        }
    });
}

function extractAllProductDetailsLink(index, categoryLink, productLinks, callback) {
    request(categoryLink, function(error, response, body) {
        if (error) {
            logger.error("Couldn’t get page " + link + " because of error: " + error);
            return;
        }

        var $ = cheerio.load(body);
        var productList = $(gCrawlPattern.product_info.link);
        // common.saveToHTMLFile(categoryLink, body);
        for (var i = 0, length = productList.length; i < length; i++) {
            var detailLink = $(productList[i]).attr('href');
            detailLink = common.insertRootLink(detailLink, curHomepage);
            // logger.info("Product link: " + detailLink);
            insertLinkWithoutDuplication(detailLink, productLinks);
        }

        var nextPageLinks = $(gCrawlPattern.paging.page_link);
        if ((nextPageLinks.length > 0) && handlePaging) {
            handleNextPages(index, nextPageLinks, gCrawlPattern.paging, productLinks, callback);
            nextPageLinks.each(function(i, page) {
                var pageLink = $(this).attr('href');
                pageLink = common.insertRootLink(pageLink, curHomepage);
                var products = extractAllProductDetailsLink(index, pageLink, productLinks, callback);
            });
        } else {
            callback(index, productLinks);
        }
    });
}

function classifyCategory(savedStore, menuItems) {
    var categoryLinks = [];
    for (var i = 0, len = menuItems.length; i < len; i++) {
        if (menuItems[i].children.length == 1) {
            var link = menuItems[i].children[0].attribs.href;
            var name = menuItems[i].children[0].children[0].data;
            logger.info("Category: " + name);
            link = common.insertRootLink(link, curHomepage);
            gModelFactory.findAndCreateCategory(savedStore, name, link,
                function(savedCategory) {});
            categoryLinks.push(link);
        } else {
            logger.info("Will not extract product list for menu items that contain sub-menu");
        }
    }
    return categoryLinks;
}

function extractAllCategoryLink(savedStore, callback) {
    logger.info("Store: " + savedStore.dataValues.home);
    request(savedStore.dataValues.home, function(error, response, body) {
        if (error) {
            logger.error("Couldn’t get page " + link + " because of error: " + error);
            return;
        }

        var $ = cheerio.load(body);
        var menuItems = $(gCrawlPattern.product_menu.item);

        var categoryLinks = classifyCategory(savedStore, menuItems);

        var allProductLinks = [];
        var categoryCount = 0;
        for (var i = 0, length = categoryLinks.length; i < length; i++) {
            extractAllProductDetailsLink(i, categoryLinks[i], allProductLinks, function(index, productLinks) {
                categoryCount++;
                logger.info("Category index = " + index);
                // allProductLinks = insertLinksWithoutDuplication(productLinks, allProductLinks);
                if ((categoryCount == length) && (callback != null)) {
                    // allProductLinks = allProductLinks.unique();
                    callback(allProductLinks);
                }
            });
        }
    });
}

exports.crawlWholeSite = function(home_page, crawl_pattern, callback) {
    gCrawlPattern = crawl_pattern;
    curHomepage = home_page;
    if (curHomepage != null && !curHomepage.startsWith('http')) {
        curHomepage = "http://" + curHomepage;
    }
    var existing_store = gModelFactory.findAndCreateStore(
        curHomepage, gCrawlPattern.store_type,
        function(store) {
            extractAllCategoryLink(store, function(allProductLinks) {
                logger.info("Done extracting product links");
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
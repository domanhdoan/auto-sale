require('string.prototype.startswith');
var cheerio = require("cheerio");
var request = require("request");
var async = require('async');
var HashMap = require('hashmap');

var logger = require("../util/logger.js");
var common = require("../util/common.js");
var gDbManager = require("../models/db_manager.js");
var gModelFactory = require("../dal/model_factory.js");

Array.prototype.unique = function() {
    return this.filter(function(value, index, array) {
        return array.indexOf(value, index + 1) < 0;
    });
};

function WebScraper(crawlPattern) {
    var skippedCategory = ['trang chu', 'tat ca san pham'];
    this.gCrawlPattern = crawlPattern;
    this.curHomepage = crawlPattern.url;
    this.categoryObjects = [];
    var currentObj = this;

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

    function handleProductProperties(savedStore, savedProduct, pageObject, sizeList, colorList, productPhotos) {
        var $ = pageObject;
        async.eachSeries(sizeList, function(size, callback) {
            var value = $(size).text().trim();
            gModelFactory.findAndCreateProductSize(savedProduct, value,
                function(size) {
                    callback();
                });
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
    }

    function extractProductDetails(savedStore, categoryObjects,
        link, detailPattern, callback) {
        request(link, function(error, response, body) {
            if (error) {
                logger.error("Couldn’t get page " + link + " because of error: " + error);
                return;
            }
            var $ = cheerio.load(body);
            var detailLink = response.request.href;
            detailLink = common.insertRootLink(detailLink, currentObj.curHomepage);
            // common.saveToHTMLFile(detailLink, body);
            var productElememt = $(detailPattern.content_area);
            var headline = $(productElememt).find(detailPattern.headline);
            var length = headline.length;
            var finger = "";
            for (var i = 0; i < length; i++) {
                finger += " " + $(headline[i]).text().latinise().toLowerCase();
            }
            logger.info("Finger = " + finger);
            var categoryNameElement = (length >= 2) ? $(headline[1]) : "";
            var categoryName = categoryNameElement.text().trim();
            var categoryLink = $(categoryNameElement).attr('href');

            var title = $(productElememt).find(detailPattern.title).text();
            var thumbnailLink = $(productElememt).find(detailPattern.thumbnail).attr('src');
            var desc = $(productElememt).find(detailPattern.desc).text();
            var priceStr = $(productElememt).find(detailPattern.price).text();
            var discountStr = $(productElememt).find(detailPattern.discount).text();
            var percent = $(productElememt).find(detailPattern.percent).text();
            var price = common.extractValue(priceStr.replaceAll(',', ''), "\\d+");
            var discount = common.extractValue(priceStr.replaceAll(',', ''), "\\d+");
            var code = $(detailPattern.code).text();

            var sizeList = $(detailPattern.size);
            var colorList = $(detailPattern.color);
            var productPhotos = $(detailPattern.photo);

            if (thumbnailLink != undefined && thumbnailLink != "" && title != "") {
                thumbnailLink = common.insertRootLink(thumbnailLink, currentObj.curHomepage)
                desc = (desc === "") ? title : desc;
                priceStr = (priceStr == null || priceStr == "") ? discountStr : priceStr;
                discountStr = (discountStr == null || discountStr == "") ? "0" : discountStr;
                percent = (percent == null || percent == "") ? percent : "0";

                finger += " " + title.latinise().toLowerCase();
                //finger += " " + desc.latinise().toLowerCase();
                finger = finger.split(' ').filter(function(item, i, allItems) {
                    return i == allItems.indexOf(item);
                }).join(' ');
                if (price > 0) {
                    var cKey = require('crypto').createHmac('sha256', categoryName)
                        .digest('hex');

                    // categoryName = categoryName.replace(/[^\w\s]/gi, '');
                    var savedCategory = categoryObjects[categoryLink];
                    // console.log("Defined Category Name: " + categoryName + " key " + cKey + " : " + JSON.stringify(savedCategory));
                    // for (var i = 0, length = Object.keys(categoryObjects).length; i < length; i++) {
                    //     var key = new String(Object.keys(categoryObjects)[i]);
                    //     var key2 = new String(categoryLink);
                    //     if (key.valueOf() === key2.valueOf()) {
                    //         logger.info(key + " ===Matched=== " + categoryName);
                    //     } else {
                    //         logger.info(key.length + " ===vs=== " + categoryName.length);
                    //         logger.info(key + " ===NotMatched=== " + categoryName);
                    //     }
                    // }
                    if (!savedCategory) {
                        logger.info("UNDEFINE product " + detailLink);
                    } else {
                        logger.info("DEFINE categoryName " + categoryName);
                        gModelFactory.findAndCreateProduct(
                            savedStore, savedCategory, title, thumbnailLink,
                            desc, price, discount, percent, detailLink, "", finger, code,
                            function(savedProduct) {
                                handleProductProperties(savedStore, savedProduct, $, sizeList, colorList, productPhotos);
                                if (!callback) {
                                    callback(link);
                                }
                            });
                    }
                } else if (price == 0) {
                    logger.info("Not save product which not have price\n");
                }
            } else {
                logger.info("\nSkipped this HTML element: " + detailLink);
            }
        });
    }

    this.processAllProductLinks = function(savedStore, categoryObjects,
        allProductLinks, detailPattern) {
        async.forEachLimit(allProductLinks, 1, function(link, callback) {
            // logger.info(link);
            extractProductDetails(savedStore, categoryObjects,
                link, detailPattern,
                function(link) {});
            callback();
        }, function(err) {
            if (err) {
                logger.error(err);
            };
        });
    }

    function extractAllProductDetailsLink(index, categoryLink, productLinks, callback) {
        request(categoryLink, function(error, response, body) {
            if (error) {
                logger.error("Couldn’t get page " + categoryLink + " because of error: " + error);
                return;
            }
            var $ = cheerio.load(body);
            var productList = $(currentObj.gCrawlPattern.product_info.link);
            // common.saveToHTMLFile(categoryLink, body);
            for (var i = 0, length = productList.length; i < length; i++) {
                var detailLink = $(productList[i]).attr('href');
                detailLink = common.insertRootLink(detailLink, currentObj.curHomepage);
                logger.error("Category Link: " + categoryLink);
                logger.info("Product link: " + detailLink);
                //insertLinkWithoutDuplication(detailLink, productLinks);
                productLinks.push(detailLink);
            }

            var nextPageLinks = $(currentObj.gCrawlPattern.paging.page_link);
            if (nextPageLinks.length > 0) {
                nextPageLinks.each(function(i, page) {
                    var pageLink = $(this).attr('href');
                    pageLink = common.insertRootLink(pageLink, currentObj.curHomepage);
                    var products = extractAllProductDetailsLink(index,
                        pageLink, productLinks, callback);
                });
            } else {
                callback(index, productLinks);
            }
        });
    }

    function classifyCategory(savedStore, webcontent) {
        var categoryLinks = [];
        var $ = cheerio.load(webcontent);
        var menu = $(currentObj.gCrawlPattern.category.menu);
        menu = menu[0];
        var menuItems = menu.children;

        for (var i = 0, len = menuItems.length; i < len; i++) {
            var children = $(menuItems[i]).find('a');
            var link = $(children[0]).attr('href');
            var name = $(children[0]).text().trim();
            if (link === undefined || name === "" || skippedCategory.indexOf(name.latinise().toLowerCase()) >= 0 || (link === currentObj.curHomepage + "/")) {
                logger.info("Skipped Category Link: " + link);
                continue;
            }
            logger.info("OK Category: " + name);
            logger.info("OK Category Link: " + link);

            gModelFactory.findAndCreateCategory(savedStore, name, link,
                function(savedCategory) {
                    var key = require('crypto').createHmac('sha256', savedCategory.dataValues.name)
                        .digest('hex');
                    var categoryName = savedCategory.dataValues.name; //.replace(/[^\w\s]/gi, '');
                    // currentObj.categoryObjects.set(categoryName, savedCategory);
                    var categoryLink = savedCategory.dataValues.link;
                    currentObj.categoryObjects[categoryLink] = savedCategory;
                });;
            categoryLinks.push(link);
        }
        return categoryLinks;
    }

    this.extractAllCategoryLink = function(savedStore, callback) {
        logger.info("Store: " + savedStore.dataValues.home);
        request(savedStore.dataValues.home, function(error, response, body) {
            var link = savedStore.dataValues.home;
            if (error) {
                logger.error("Couldn’t get page " + link + " because of error: " + error);
                return;
            }
            var allProductLinks = [];
            var categoryCount = 0;
            var categoryLinks = classifyCategory(savedStore, body);
            for (var i = 0, length = categoryLinks.length; i < length; i++) {
                extractAllProductDetailsLink(i, categoryLinks[i], allProductLinks, function(index, productLinks) {
                    categoryCount++;
                    logger.info("Category index = " + index);
                    if ((categoryCount == length) && (callback != null)) {
                        allProductLinks = allProductLinks.unique();
                        callback(allProductLinks, currentObj.categoryObjects);
                    }
                });
            }
        });
    }
}

WebScraper.prototype.crawlWholeSite = function(callback) {

    if (this.curHomepage != null && !this.curHomepage.startsWith('http')) {
        this.curHomepage = "http://" + this.curHomepage;
    }
    var currentScope = this;
    gModelFactory.findAndCreateStore(
        this.curHomepage, this.gCrawlPattern.store_type,
        function(store) {
            currentScope.extractAllCategoryLink(store, function(allProductLinks) {
                logger.info("Done extracting product links");
                currentScope.processAllProductLinks(store, currentScope.categoryObjects,
                    allProductLinks, currentScope.gCrawlPattern.product_info.details);
            });
        });

}

WebScraper.prototype.extractThumbUrl = function(home_page, input_thumb, callback) {
    var encoded_uri = encodeURIComponent(input_thumb);
    var goole_search_image = "https://www.google.com/searchbyimage?&image_url="
    goole_search_image += encoded_uri + "&as_sitesearch=" + home_page;
    //request.debug = true;
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
            common.saveToHTMLFile("search", body);
            var search_items = $('div.srg div.g div.rc div.s div div.th._lyb a');
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

module.exports = WebScraper;
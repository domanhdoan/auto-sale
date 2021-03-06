require('string.prototype.startswith');
var cheerio = require("cheerio");
var request = require("request");
var async = require('async');
var HashMap = require('hashmap');

var logger = require("../util/logger.js");
var common = require("../util/common.js");
var gDbManager = require("../models/db_manager.js");
var gModelFactory = require("../dal/model_factory.js");
var lastSavedCategory = null;

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
    this.productNCategoryMapping = [];
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

    function extractPropertiesFromDesc(savedStore, savedProduct){
        // if can not handle color list => handle from desc
        var desc = savedProduct.dataValues.desc;
        //logger.info("desc = " + desc);
        var propertiesArray = desc.trim().split(/\r?\n/);
        for (var i = 0; i < propertiesArray.length; i++){
            var property = propertiesArray[i].replace("–", "").trim().toLowerCase();
            logger.info("property = " + property);
            if(true === property.startsWith("màu sắc:")){
                var value  = property.replace("màu sắc:", "").replace("màu ", "").replace(".", "").trim();
                gModelFactory.findAndCreateProductProperty(
                    savedStore, savedProduct, "color", gDbManager.Sequelize.STRING,
                    value, function(color) {});
            }else if(property.indexOf("chất liệu") > -1){
                var tempArray = property.split("chất liệu");
                var value  = tempArray[1].replace(":", "").replace(".", "").trim();
                logger.info("Material = " + value);
                if(common.isDefined()){
                    gModelFactory.findAndCreateProductProperty(
                        savedStore, savedProduct, "material", gDbManager.Sequelize.STRING,
                        value, function(material) {});
                }else{
                    logger.info("Not add NULL Photo link");
                }
            }else if(true === property.startsWith("kiểu dáng:")){
                var value  = property.replace("kiểu dáng:", "").replace(".", "").trim();
                logger.info("Shape = " + value);
                gModelFactory.findAndCreateProductProperty(
                    savedStore, savedProduct, "shape", gDbManager.Sequelize.STRING,
                    value, function(shape) {});
            }else if(true === property.startsWith("xuất xứ:")){
                var value  = property.replace("xuất xứ:", "").replace(".", "").trim();
                logger.info("Country = " + value);
                gModelFactory.findAndCreateProductProperty(
                    savedStore, savedProduct, "country", gDbManager.Sequelize.STRING,
                    value, function(country) {});
            }else if(true === property.startsWith("thương hiệu:")){
                var value  = property.replace("thương hiệu:", "").replace(".", "").trim();
                logger.info("Brand = " + value);
                gModelFactory.findAndCreateProductProperty(
                    savedStore, savedProduct, "brand", gDbManager.Sequelize.STRING,
                    value, function(country) {});
            }else if(property.indexOf("size") > -1){
                var minSize = -1;
                var maxSize = -1;
                if(property.indexOf("full size") > -1){
                    minSize = 35;
                    maxSize = 43;
                }else{
                    var values = property.replace("size:", "").trim();//.split(",");
                    var rePattern = new RegExp(/[0-9]{2}/, "gi");
                    var arrMatches = values.match(rePattern);
                    if(arrMatches.length == 1){
                        minSize = parseInt(arrMatches[0]);
                        maxSize = parseInt(arrMatches[0]);
                    }else if(arrMatches.length == 2){
                        minSize = parseInt(arrMatches[0]);
                        maxSize = parseInt(arrMatches[1]);
                    }
                }
                logger.info("minSize = " + minSize.toString());
                logger.info("maxSize = " + maxSize.toString());
                for(var i = minSize; (i <= maxSize) & (i > 0); i++){
                    logger.info("Size = " + i.toString());
                    gModelFactory.findAndCreateProductProperty(
                        savedStore, savedProduct, "size", gDbManager.Sequelize.INTEGER,
                        i, function(size) {});

                }
            }else{
                logger.info("Not support to handle this property: " + property);
            }
        }
    }
    
    function handleProductProperties(savedStore, savedProduct, pageObject, sizeList, colorList, productPhotos) {
        var $ = pageObject;
        async.eachSeries(sizeList, function(size, callback) {
            var value = $(size).text().trim();
            logger.info("handleProductProperties size = " + value);
            gModelFactory.findAndCreateProductProperty(savedStore, savedProduct, 
                "size", gDbManager.Sequelize.INTEGER, value, function(size) {
                 callback();
            });
        }, function alert(err) {
            logger.info("err = " + err);
        });

        async.eachSeries(colorList, function(color, callback) {
            var name = $(color).text().trim();
            var value = $(color).text().trim();
            gModelFactory.findAndCreateProductProperty(savedStore, savedProduct, 
                "color", gDbManager.Sequelize.STRING, value, function(color) {
                 callback();
            });
        }, function alert(err) {
            logger.info("err = " + err);
        });

        async.eachSeries(productPhotos, function(photo, callback) {
            var link = $(photo).attr('href');
            logger.info("Link = " + link);
            if(common.isDefined()){
                gModelFactory.findAndCreateProductProperty(savedStore, savedProduct, 
                    "photo", gDbManager.Sequelize.STRING, link, function(photo) {
                     callback();
                });                
            }else{
                logger.info("Not add NULL Photo link");
            }
        }, function alert(err) {
            logger.info("err = " + err);
        });
        
        //logger.info("desc = " + JSON.stringify(savedProduct.dataValues.desc));
        extractPropertiesFromDesc(savedStore, savedProduct);
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
            detailLink = common.insertRootLink(detailLink.trim(), currentObj.curHomepage);
            
            var productElememt = $(detailPattern.content_area);
            
            var headline = $(productElememt).find(detailPattern.headline);
            var length = headline.length;
            var finger = "";
            for (var i = 1; i < length; i++) {
                finger += " " + $(headline[i]).text().latinise().toLowerCase().trim();
            }

            var categoryNameElement = (length >= 2) ? $(headline[1]) : "";
            var categoryLink = (categoryNameElement !== "") ? $(categoryNameElement).attr('href') : "";

            var title = $(productElememt).find(detailPattern.title).text();
            var thumbnailLink = $(productElememt).find(detailPattern.thumbnail).attr('src');
            
            common.shortenURL(thumbnailLink, function(shortURL){
                var desc = $(productElememt).find(detailPattern.desc).text();
                var priceStr = $(productElememt).find(detailPattern.price).text();
                var discountStr = $(productElememt).find(detailPattern.discount).text();

                var code = $(detailPattern.code).text();
                if(!common.isDefined(code)){                
                    code = common.extractProductCode(title, detailPattern.codepatern).code;
                }
                var type = common.extractProductType(title);

                var sizeList = $(detailPattern.size);
                var colorList = $(detailPattern.color);
                var productPhotos = $(detailPattern.photo);

                logger.info("Processing " + detailLink);
                logger.info("Headline = " + $(headline).text());
                logger.info("Finger = " + finger);
                logger.info("code = " + code);
                logger.info("categoryLink = " + categoryLink);

                if (shortURL != undefined && shortURL != "" && title != "") {
                    shortURL = common.insertRootLink(shortURL, currentObj.curHomepage)

                    desc = (desc === "") ? title : desc;
                    priceStr = (priceStr == null || priceStr == "") ? discountStr : priceStr;
                    discountStr = (discountStr == null || discountStr == "") ? "0" : discountStr;
                    var price = common.extractValue(priceStr.replaceAll(',', '').replaceAll('.', ''), "\\d+");
                    var discount = common.extractValue(discountStr.replaceAll(',', '').replaceAll('.', ''), "\\d+");
                    // logger.info("priceStr = " + priceStr);
                    // logger.info("discountStr = " + discountStr);
                    // logger.info("price = " + price);
                    // logger.info("discount = " + discount);
                    
                    finger += " " + title.latinise().toLowerCase();
                    //finger += " " + desc.latinise().toLowerCase();
                    finger = finger.split(' ').filter(function(item, i, allItems) {
                        return i == allItems.indexOf(item);
                    }).join(' ');
                    if (price > 0) {
                        // var cKey = require('crypto').createHmac('sha256', categoryName)
                            // .digest('hex');
                        /*
                        var savedCategory = categoryObjects[categoryLink];
                        if (!savedCategory) {
                            logger.info("UNDEFINE category for " + detailLink);
                            common.saveToFile("scraping_log.txt", "underfined category\t" + categoryLink + "\t" + detailLink);
                            savedCategory = lastSavedCategory;
                        } else {
                            logger.info("DEFINE categoryName for " + detailLink);
                            lastSavedCategory = savedCategory;
                        }
                        */
                        var savedCategory = currentObj.productNCategoryMapping[detailLink];
                        if(savedCategory){
                            gModelFactory.findAndCreateProduct(
                                savedStore, savedCategory, title, shortURL,
                                desc, price, discount, detailLink, type, finger, code,
                                function(savedProduct) {
                                    handleProductProperties(savedStore, savedProduct, $, 
                                    sizeList, colorList, productPhotos);
                                    common.saveToFile("scraping_log.txt", "passed\t" + link);
                                    // Add thumbnail into photo table
                                    gModelFactory.findAndCreateProductProperty(savedStore, savedProduct, 
                                        "photo", gDbManager.Sequelize.STRING, thumbnailLink, function(photo) {
                                         callback();
                                    });
                                    if (!callback) {
                                        callback(link);
                                    }
                                });

                        }
                    } else if (price == 0) {
                        logger.info("Not save product which not have price\n");
                        common.saveToFile("scraping_log.txt", "failed by not have price\t" + link);
                    }
                } else {
					common.saveToFile("scraping_log.txt", "shortURL = " + shortURL + "title = " + title);
                    logger.info("\nSkipped this HTML element: " + detailLink);
                    common.saveToFile("scraping_log.txt", "failed by parsing html\t" + link);
                }                
            });
        });
    }

    this.processAllProductLinks = function(savedStore, categoryObjects,
        allProductLinks, detailPattern) {
        async.forEachLimit(allProductLinks, 1, function(link, callback) {
            logger.info(link);
            extractProductDetails(savedStore, categoryObjects,
                link, detailPattern,
                function(link) {});
            callback();
        }, function(err) {
            if (err) {
                logger.error(err);
            };
        });

        // async.eachSeries(allProductLinks, function (url, callback) {
        //     extractProductDetails(savedStore, categoryObjects,
        //         url, detailPattern,
        //         function (link) {
        //             callback();
        //         });
        // }, function (err) {
        //     if (err) {
        //         logger.error(err);
        //     };
        // });
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
			var tempArray = categoryLink.split('?');
			common.saveToFile("scraping_log.txt", "Category link\t" + categoryLink);
			categoryLink = (tempArray.length == 1)?categoryLink:tempArray[0];
            for (var i = 0, length = productList.length; i < length; i++) {
                var detailLink = $(productList[i]).attr('href');
                detailLink = common.insertRootLink(detailLink, currentObj.curHomepage);
                //insertLinkWithoutDuplication(detailLink, productLinks);
                if(productLinks.indexOf(detailLink) < 0){
                    productLinks.push(detailLink);
                    common.saveToFile("scraping_log.txt", "product link\t" + detailLink);
                    currentObj.productNCategoryMapping[detailLink] = currentObj.categoryObjects[categoryLink];
                }
            }
			var nextPageLinks = $(currentObj.gCrawlPattern.paging.page_link);
			if ((nextPageLinks.length > 0) && (tempArray.length == 1)) {
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
        var menuItems = (menu != undefined && menu.length > 0) ? menu[0].children : [];

        for (var i = 0, len = menuItems.length; i < len; i++) {
            var children = $(menuItems[i]).find('a');
            var link = $(children[0]).attr('href');
            var name = $(children[0]).text().trim();
            if (link === undefined || name === "" 
            || (skippedCategory.indexOf(name.latinise().toLowerCase()) >= 0)
            || (link === currentObj.curHomepage + "/")) {
                logger.info("Skipped Category Link: " + link);
                continue;
            }
            
            common.saveToFile("scraping_log.txt", "category link\t" + link);
            
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
            var length = categoryLinks.length;
            for (var i = 0, length = categoryLinks.length; i < length; i++) {
                // async.eachSeries(categoryLinks, function (url, callback2) {
                // var index = categoryLinks.indexOf(url);
                var index = i;
                var url = categoryLinks[i];

                extractAllProductDetailsLink(index, url, allProductLinks, function(index, productLinks) {
                    categoryCount++;
                    //logger.info("Category index = " + index);
                    if ((categoryCount == length) && (callback != null)) {
                        allProductLinks = allProductLinks.unique();
                        callback(allProductLinks, currentObj.categoryObjects);
                    }
                    // callback2();
                });
                // });
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
                'User-Agent': 'Mozilla/5.0  (Windows NT 6.1; WOW64; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; \
                .NET CLR 3.0.30729; Media Center PC 6.0; InfoPath.3; .NET4.0C; .NET4.0E; CNS_UA; AD_LOGON=4C47452E4E4554; rv:11.0) like Gecko\
                 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36'
            }
        };

        request(options, function(error, response, body) {
            var $ = cheerio.load(body);
            // common.saveToHTMLFile("search", body);
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
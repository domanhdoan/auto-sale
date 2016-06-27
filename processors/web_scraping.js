require('string.prototype.startswith');
var logger = require("../util/logger.js");
var common = require("../util/common.js");

var cheerio = require("cheerio");
var request = require("request");
var curHomepage = "";

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
            var products = extractOneCategory(saved_store, saved_category,
                link, false);
        });
    } else {
        logger.info("ONLY have ONE page");
    }
}

function extractProductDetails(product_pattern, saved_product) {
    request(saved_product.link.replaceAll("%%", "-"), function(error, response, body) {
        if (error) {
            logger.error("Couldn’t get page " + saved_product.link + " because of error: " + error);
            return;
        }
        var $ = cheerio.load(body);
        var detailLink = response.request.href;

        var colors = [];
        var sizes = [];
        var sizeList = $(product_pattern.details.size);
        var colorList = $(product_pattern.details.color);
        var productPhotos = $(product_pattern.details.photo);

        sizeList.each(function(i, size) {
            var size_value = $(size).text().trim();
            console.log("Size = " + size_value);
            var instock = $(size).find(product_pattern.details.instock);
            if (instock.length > 0) {
                console.log("Size out of stock = " + instock.text().trim());
            } else {
                gModelFactory.create_product_size(saved_product, size_value,
                    function(save_size) {});
            }
        });

        colorList.each(function(i, color) {
            var color_name = $(color).text().trim();
            var color_value = $(color).text().trim();
            colors.push($(color).text().trim());
            gModelFactory.create_product_color(saved_product, color_name,
                color_value,
                function(save_size) {});
        });

        productPhotos.each(function(i, photo) {
            var link = $(photo).attr('href');
            logger.info("Link = " + link);
        });

        var code = $(product_pattern.details.code);
        saved_product.updateAttributes({
            code: code.text().trim()
        });
    });
}

function extractOneCategory(saved_store, saved_category, handle_paging, callback) {
    var productlist = [];
    var link = saved_category.dataValues.link;
    logger.info("Sub-category: " + link);
    request(link, function(error, response, body) {
        if (error) {
            logger.error("Couldn’t get page " + link + " because of error: " + error);
            return;
        }

        var $ = cheerio.load(body);

        // common.saveToFile(response.request.href, body);

        var product_pattern = gCrawlPattern.product_info;
        var product_list = $(product_pattern.product_list);

        for (var i = 0, len = product_list.length; i < len; i++) {
            var title = $(product_list[i]).find(product_pattern.title).text();
            var thumbnailLink = $(product_list[i]).find(product_pattern.thumbnail).attr('src');
            var desc = $(product_list[i]).find(product_pattern.desc).text();

            if (thumbnailLink != undefined && thumbnailLink != "" && title != "") {
                var detailLink = $(product_list[i]).find(product_pattern.detail_link).attr('href');
                detailLink = common.insertRootLink(detailLink, curHomepage);
                thumbnailLink = common.insertRootLink(thumbnailLink, curHomepage)

                common.saveToFile("./temp/product_links_save.txt", detailLink);

                if (desc == "") {
                    desc = title;
                }

                var priceStr = $(product_list[i]).find(product_pattern.price).text();
                var discountStr = $(product_list[i]).find(product_pattern.discount).text();
                var percent = $(product_list[i]).find(product_pattern.percent).text();

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
                    logger.info("create_product = " + detailLink);
                    gModelFactory.findAndCreateProduct(
                        saved_store, saved_category,
                        title, thumbnailLink,
                        desc, price,
                        discount, percent,
                        detailLink, "" /*finger*/ , "",
                        gCrawlPattern.product_code_pattern,
                        function(saved_product) {
                            extractProductDetails(product_pattern, saved_product);
                        });
                } else if (price == 0) {
                    logger.info("Not save product which not have price\n");
                }
            } else {
                logger.info("Skipped this HTML element\n");
            }
        }

        if (handle_paging) {
            handleNextPages($, saved_store, saved_category, product_pattern);
        }

        if (callback != null) {
            callback();
        }
    });
    return productlist;
}

function extractCategories(home_page_object, saved_store, callback) {
    var $ = home_page_object;
    var menu_items = $(gCrawlPattern.product_menu.item);
    logger.info("Store: " + saved_store.dataValues.home);
    for (var i = 0, len = menu_items.length; i < len; i++) {
        var item = $(menu_items[i]).find(gCrawlPattern
            .product_menu.item_link);
        var category = item.text();
        if (menu_items[i].children.length == 1) {
            logger.info("Category: " + category);
            // logger.info("\nmenu_items[" + i + "] = " + $(menu_items[i]));
            var item_link = item.attr("href");
            item_link = common.insertRootLink(item_link, curHomepage);
            gModelFactory.findAndCreateCategory(saved_store, category, item_link,
                function(saved_category) {
                    extractOneCategory(saved_store, saved_category, true, callback);
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
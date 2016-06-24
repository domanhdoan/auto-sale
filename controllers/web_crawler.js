require('string.prototype.startswith');
var logger = require("../util/logger.js");
var common = require("../util/common.js");

var cheerio = require("cheerio");
var request = require("request");
var cur_home_page = "";
var g_crawl_pattern = null;
var g_orm_manager = null;

var g_model_factory = require("../dal/model_factory.js");

function insertPrefixForLink(current_link, home_page) {
      if (current_link != null && !current_link.startsWith('http')) {
            current_link = home_page + current_link;
      }
      return current_link;
}

function handleNextPages(page_object, saved_store, saved_category,
      product_pattern) {
      var $ = page_object;
      // Extract data from remain pages
      var page_list = $(product_pattern.product_paging.page_link);
      if (page_list.length > 0) {
            page_list.each(function (i, page) {
                  var link = $(this).attr('href');
                  link = insertPrefixForLink(link, cur_home_page);
                  var products = extractOneCategory(saved_store, saved_category,
                        link, false);
            });
      } else {
            logger.info("ONLY have ONE page");
      }
}

function extractProductDetails(product_pattern, saved_product) {
      request(saved_product.link.replaceAll("%%", "-"), function (error, response, body) {
            if (error) {
                  logger.error("Couldn’t get page " + saved_product.link + " because of error: " + error);
                  return;
            }
            var $ = cheerio.load(body);

            var size_list = $(product_pattern.details.size);
            var color_list = $(product_pattern.details.color);
            var colors = [];
            var sizes = [];
            size_list.each(function (i, size) {
                  var size_value = $(size).text().trim();
                  console.log("Size = " + size_value);
                  var instock = $(size).find(product_pattern.details.instock);
                  if (instock.length > 0) {
                        console.log("Size out of stock = " + instock.text().trim());
                  } else {
                        g_model_factory.create_product_size(saved_product, size_value,
                              function (save_size) {
                              });
                  }
            });

            color_list.each(function (i, color) {
                  var color_name = $(color).text().trim();
                  var color_value = $(color).text().trim();
                  colors.push($(color).text().trim());
                  g_model_factory.create_product_color(saved_product, color_name,
                        color_value, function (save_size) {
                        });
            });

            var code = $(product_pattern.details.code);
            saved_product.updateAttributes({
                  code: code.text().trim()
            });
      });
}

function extractOneCategory(saved_store, saved_category, handle_paging) {
      var productlist = [];
      var link = saved_category.dataValues.link;
      logger.info("Sub-category: " + link);
      request(link, function (error, response, body) {
            if (error) {
                  logger.error("Couldn’t get page " + link + " because of error: " + error);
                  return;
            }

            var $ = cheerio.load(body);
            var product_pattern = g_crawl_pattern.product_info;
            var product_list = $(product_pattern.product_list);

            for (var i = 0, len = product_list.length; i < len; i++) {
                  var product_title = $(product_list[i]).find(product_pattern.title).text();
                  var product_thumbnail = $(product_list[i]).find(product_pattern.thumbnail).attr('src');
                  var product_desc = $(product_list[i]).find(product_pattern.desc).text();

                  if (product_thumbnail != undefined && product_thumbnail != "" && product_title != "") {
                        var product_detail_link = $(product_list[i]).find(product_pattern.detail_link).attr('href');
                        product_detail_link = insertPrefixForLink(product_detail_link, cur_home_page);
                        product_thumbnail = insertPrefixForLink(product_thumbnail, cur_home_page)

                        if (product_desc == "") {
                              product_desc = product_title;
                        }

                        var product_price = $(product_list[i]).find(product_pattern.price).text();
                        var product_discount = $(product_list[i]).find(product_pattern.discount).text();
                        var product_percent = $(product_list[i]).find(product_pattern.percent).text();

                        if (product_price == null || product_price == "") {
                              product_price = product_discount;
                        }

                        if (product_discount == null || product_discount == "") {
                              product_discount = "0";
                        }

                        if (product_percent == null || product_percent == "") {
                              product_percent = "0";
                        }
                        var price = common.extract_price(product_price);
                        var discount = common.extract_price(product_discount);

                        if (price > 0) {
                              logger.info("create_product = " + product_detail_link);
                              g_model_factory.findAndCreateProduct(
                                    saved_store, saved_category,
                                    product_title, product_thumbnail,
                                    product_desc, price,
                                    discount, product_percent,
                                    product_detail_link, ""/*finger*/, "",
                                    g_crawl_pattern.product_code_pattern,
                                    function (saved_product) {
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
      });
      return productlist;
}

function extractCategories(home_page_object, saved_store) {
      var $ = home_page_object;
      var menu_items = $(g_crawl_pattern.product_menu.item);
      for (var i = 0, len = menu_items.length; i < len;i++) {
            var item = $(menu_items[i]).find(g_crawl_pattern
                  .product_menu.item_link);
            var category = item.text();
            if (menu_items[i].children.length == 1) {
                  logger.info("Category: " + category);
                  // logger.info("\nmenu_items[" + i + "] = " + $(menu_items[i]));
                  var item_link = item.attr("href");
                  item_link = insertPrefixForLink(item_link, cur_home_page);
                  g_model_factory.findAndCreateCategory(saved_store, category, item_link,
                        function (saved_category) {
                              extractOneCategory(saved_store, saved_category, true);
                        });
            } else {
                  logger.info("Will not extract product list for menu items that contain sub-menu");
            }
      }
}

exports.init = function (crawl_pattern, orm_manager) {
      g_crawl_pattern = crawl_pattern;
      g_orm_manager = orm_manager;
      g_model_factory.init(g_orm_manager);
}

exports.crawlWholeSite = function (home_page, callback) {
      cur_home_page = home_page;
      if (cur_home_page != null && !cur_home_page.startsWith('http')) {
            cur_home_page = "http://" + cur_home_page;
      }
      var existing_store = g_model_factory.findAndCreateStore(cur_home_page,
            g_crawl_pattern.store_type, function (store) {
                  request(store.dataValues.home, function (error, response, body) {
                        var web_content = body;
                        if (error) {
                              logger.error("Couldn’t get page because of error: " + error);
                              return;
                        }
                        // load the web_content of the page into Cheerio so we can traverse the DOM
                        var $ = cheerio.load(web_content);
                        extractCategories($, store);
                        callback();
                  });
            });
}

exports.extract_product_thumb_link = function (home_page, input_thumb, callback) {
      var encoded_uri = encodeURIComponent(input_thumb);
      var goole_search_image = "https://www.google.com/searchbyimage?&image_url="
            + encoded_uri + "&as_sitesearch=" + home_page;
      request.debug = true;
      request(goole_search_image, {
            followRedirect: true,
      }, function (error, response, body) {
            var options = {
                  url: response.req._headers.referer + "&as_sitesearch=" + home_page,
                  headers: {
                        followRedirect: true,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36'
                  }
            };

            request(options, function (error, response, body) {
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
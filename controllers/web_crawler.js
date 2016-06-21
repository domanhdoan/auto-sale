require('string.prototype.startswith');
var logger = require("../util/logger.js");
var common = require("../util/common.js");

var cheerio = require("cheerio");
var request = require("request");
var cur_home_page = "";
var g_crawl_pattern = null;
var g_orm_manager = null;
var g_model_factory = require("../models/model_factory.js");

var url_link = new Map();

function insert_prefix_homepage(current_link, home_page) {
      if (!current_link.startsWith('http')) {
            current_link = home_page + current_link;
      }
      return current_link;
}

function extract_next_pages(page_object, saved_store, saved_category,
      product_pattern) {
      var $ = page_object;
      // Extract data from remain pages
      var page_list = $(product_pattern.product_paging.page_link);
      if (page_list.length > 0) {
            page_list.each(function (i, page) {
                  var link = $(this).attr('href');
                  link = insert_prefix_homepage(link, cur_home_page);
                  var products = extract_productlist_from_link(saved_store, saved_category,
                        link, false);
            });
      } else {
            logger.info("ONLY have ONE page");
      }
}

function extract_product_detail(product_pattern, saved_product) {
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

function extract_productlist_from_link(saved_store, saved_category,
      link, handle_paging) {
      var productlist = [];

      request(link, function (error, response, body) {
            if (error) {
                  logger.error("Couldn’t get page " + link + " because of error: " + error);
                  return;
            }

            var $ = cheerio.load(body);
            var product_pattern = g_crawl_pattern.product_info;
            var product_list = $(product_pattern.product_list);

            product_list.each(function (i, product) {
                  var product_title = $(this).find(product_pattern.title).text();
                  var product_thumbnail = $(this).find(product_pattern.thumbnail).attr('src');
                  var product_desc = $(this).find(product_pattern.desc).text();

                  if (product_thumbnail != "" && product_title != "") {
                        var product_detail_link = $(this).find(product_pattern.detail_link).attr('href');
                        product_detail_link = insert_prefix_homepage(product_detail_link, cur_home_page);
                        product_thumbnail = insert_prefix_homepage(product_thumbnail, cur_home_page)

                        if (product_desc == "") {
                              product_desc = product_title;
                        }

                        var product_price = $(this).find(product_pattern.price).text();
                        var product_discount = $(this).find(product_pattern.discount).text();
                        var product_percent = $(this).find(product_pattern.percent).text();

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
                              //common.generate_remoteimg_hash(product_thumbnail, function (finger) {
                                    logger.info("create_product = " + product_detail_link);
                                    g_model_factory.create_product(
                                          saved_store, saved_category,
                                          product_title, product_thumbnail,
                                          product_desc, price,
                                          discount, product_percent,
                                          product_detail_link, ""/*finger*/, "",
                                          g_crawl_pattern.product_code_pattern,
                                          function (saved_product) {
                                                extract_product_detail(product_pattern, saved_product);
                                          });
                              //});
                        } else if (price == 0) {
                              logger.info("Not save product which not have price\n");
                        }
                  } else {
                        logger.info("Skipped this HTML element\n");
                  }
            });

            if (handle_paging) {
                  extract_next_pages($, saved_store, saved_category, product_pattern);
            }
      });
      return productlist;
}

function extract_productlist_from_category(home_page_object, saved_store, menu_items) {
      var $ = home_page_object;
      menu_items.each(function (i, product) {
            var item_link = $(this).children('a').attr("href");
            item_link = insert_prefix_homepage(item_link, cur_home_page);
            var category = $(this).children('a').text();
            if (category != null) {
                  logger.info("Category: " + item_link);
                  g_model_factory.create_category(saved_store, category, function (saved_category) {
                        extract_productlist_from_link(saved_store, saved_category,
                              item_link, true);
                  });
            } else {
                  logger.info("Will not extract product list for null category");
            }
      });
}

exports.init = function (crawl_pattern, orm_manager) {
      g_crawl_pattern = crawl_pattern;
      g_orm_manager = orm_manager;
      g_model_factory.init(g_orm_manager);
}

exports.crawl_alink_nodepth = function (link, callback) {
      extract_productlist_from_link(null, null, link, false, false, callback);
}

exports.crawl_alink_withdepth = function (home_page) {
      request(home_page, function (error, response, body) {
            var web_content = body;
            if (error) {
                  logger.error("Couldn’t get page because of error: " + error);
                  return;
            }
            // load the web_content of the page into Cheerio so we can traverse the DOM
            cur_home_page = home_page;
            var $ = cheerio.load(web_content);
            var menu = $(g_crawl_pattern.product_menu.panel);
            // var menu_items = menu.find(g_crawl_pattern.product_menu.item);
            var menu_items = menu.children();
            var existing_store = g_orm_manager.Store.findAndCountAll({
                  where: {
                        home: cur_home_page
                  }
            }).then(function (store) {
                  if (store.count == 0 && cur_home_page != null) {
                        g_orm_manager.Store
                              .build({
                                    home: cur_home_page,
                                    type: g_crawl_pattern.store_type
                              })
                              .save()
                              .then(function (saved_store) {
                                    logger.info("Saved " + saved_store);
                                    extract_productlist_from_category($, saved_store, menu_items);
                              }).catch(function (error) {
                                    logger.error(error);
                              });
                  } else if (store.count > 0) {
                        logger.info("Not add new store that existed\n");
                        extract_productlist_from_category($, store.rows[0], menu_items);
                  } else {
                        logger.info("Not add new store that have emtpy home page\n");
                  }
            });
      });
}

exports.extract_product_thumb_link = function (home_page, input_thumb, callback) {
      var encoded_uri = encodeURIComponent(input_thumb);
      var goole_search_image = "https://www.google.com/searchbyimage?&image_url=" 
            + encoded_uri +"&as_sitesearch=" + home_page;
      request.debug = true;
      request(goole_search_image, {
            followRedirect: true,
      }, function (error, response, body) {
            var options = {
                  url: response.req._headers.referer+"&as_sitesearch=" + home_page,
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
require('string.prototype.startswith');
var logger = require("../util/logger.js");

var cheerio = require("cheerio");
var request = require("request");
var cur_home_page = "";
var g_crawl_pattern = null;
var g_orm_manager = null;
var $ = null;

function insert_prefix_homepage(current_link, home_page) {
      if (!current_link.startsWith('http')) {
            current_link = home_page + current_link;
      }
      return current_link;
}

function extract_productlist_from_link(saved_store, saved_category, link, handle_paging, save_to_db, callback) {
      var productlist = [];

      request(link, function (error, response, body) {
            if (error) {
                  logger.error("Couldn’t get page " + link + " because of error: " + error);
                  return;
            }

            logger.info("Sub-category: " + link + "");
            var $ = cheerio.load(body);
            var product_pattern = g_crawl_pattern.product_info;
            var product_list = $(product_pattern.product_list);
            var remain_pages = $(product_pattern.product_paging.page_list);
            var crawl_product_list = [];
            
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

                        if (product_price == undefined || product_price == "") {
                              product_price = product_discount;
                        }

                        if (product_discount == undefined || product_discount == "") {
                              product_discount = 0;
                        }

                        if (product_percent == undefined || product_percent == "") {
                              product_percent = 0;
                        }
                        // logger.info("Title = " + product_title.trim());
                        if (parseInt(product_price) > 0 && save_to_db) {
                              g_orm_manager.Product
                                    .build({
                                          title: product_title,
                                          thumbnail: product_thumbnail.replaceAll('-', '%%'),
                                          desc: product_desc,
                                          price: product_price,
                                          discount: product_discount,
                                          percent: product_percent,
                                          link: product_detail_link.replaceAll('-', '%%'),
                                          size: "",
                                          brand: ""
                                    }).save()
                                    .then(function (saved_product) {
                                          logger.info(" Save new product successfully");
                                          saved_product.setCategory(saved_category);
                                          saved_product.setStore(saved_store);
                                    }).catch(function (error) {
                                          logger.error(error);
                                    });
                        } else if (parseInt(product_price) > 0) {
                              var product_data = {};
                              product_data.title = product_title;
                              product_data.thunbnail = product_thumbnail;
                              product_data.price = product_price;
                              crawl_product_list.push(product_data);              
                        } else {
                              logger.info("Not save product which not have price\n");
                        }
                  } else {
                        process.stdout.write("Skipped this HTML element\n");
                  }
            });
            
            if(callback != null){
                  callback(crawl_product_list);
            }
            
            // Extract data from remain pages
            if (remain_pages.length > 0 && handle_paging) {
                  var page_list = remain_pages.find(product_pattern.product_paging.page_link);
                  if (page_list.length > 0) {
                        page_list.each(function (i, page) {
                              var link = $(this).attr('href');
                              link = insert_prefix_homepage(link, cur_home_page);
                              logger.info("Start Page: " + link + "");
                              var products = extract_productlist_from_link(saved_store, saved_category,
                                    link, false, save_to_db, callback);
                              productlist.push(products);
                              logger.info("End Page: " + link + "");
                        });
                  } else {
                        logger.info("ONLY have ONE page");
                  }
            } else {

            }
      });
      return productlist;
}

function extract_productlist_from_category(saved_store, menu_items) {
      menu_items.each(function (i, product) {
            var item_link = $(this).attr("href");
            item_link = insert_prefix_homepage(item_link, cur_home_page);
            var category = $(this).text();
            if (category != null) {
                  g_orm_manager.Category.findAndCountAll({
                        where: {
                              name: category
                        }
                  }).then(function (results) {
                        if (results.count == 0) {
                              g_orm_manager.Category
                                    .build({
                                          name: category,
                                    })
                                    .save()
                                    .then(function (saved_category) {
                                          saved_category.setStore(saved_store);
                                          extract_productlist_from_link(saved_store, saved_category,
                                                item_link, true, true, null);
                                    }).catch(function (error) {
                                          logger.error(error);
                                    });
                        } else {
                              logger.info("Not save existing category");
                              extract_productlist_from_link(saved_store, results.rows[0],
                                    item_link, true, true, null);
                        }
                  });
            } else {
                  logger.info("Will not extract product list for null category");
            }
      });
}

exports.init = function (crawl_pattern, orm_manager) {
      g_crawl_pattern = crawl_pattern;
      g_orm_manager = orm_manager;
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
            $ = cheerio.load(web_content);
            var menu = $(g_crawl_pattern.product_menu.panel);
            var menu_items = menu.find(g_crawl_pattern.product_menu.item);
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
                                    extract_productlist_from_category(saved_store, menu_items);
                              }).catch(function (error) {
                                    logger.error(error);
                              });
                  } else if (store.count > 0) {
                        logger.info("Not add new store that existed\n");
                        extract_productlist_from_category(store.rows[0], menu_items);
                  } else {
                        logger.info("Not add new store that have emtpy home page\n");
                  }
            });
      });
}

exports.crawl_alink_nodepth = function (link, callback) {
      extract_productlist_from_link(null, null, link, true, false, callback);
}
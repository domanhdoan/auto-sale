require('string.prototype.startswith');
var models = require("../models/product_model.js");
var cheerio = require("cheerio");
var request = require("request");
var cur_home_page = "";
var g_crawl_pattern = null;
var g_orm_manager = null;

function insert_prefix_homepage(current_link, home_page) {
      if (!current_link.startsWith('http')) {
            current_link = home_page + current_link;
      }
      return current_link;
}

function extract_productlist_from_link(link, handle_paging) {
      request(link, function (error, response, body) {
            if (error) {
                  console.log("Couldn’t get page " + link + " because of error: " + error);
                  return;
            }
            console.log("Sub-category: " + link + "");
            var $ = cheerio.load(body);
            var product_pattern = g_crawl_pattern.product_info;
            var product_list = $(product_pattern.product_list);
            var remain_pages = $(product_pattern.product_paging.page_list);

            product_list.each(function (i, product) {
                  var product_title = $(this).find(product_pattern.title).text();
                  var product_thumbnail = $(this).find(product_pattern.thumbnail).attr('src');
                  var product_desc = $(this).find(product_pattern.desc).text();

                  if (product_thumbnail != "" && product_title != "") {
                        var product_detail_link = $(this).find(product_pattern.detail_link).attr('href');
                        product_detail_link = insert_prefix_homepage(product_detail_link, cur_home_page);

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

                        process.stdout.write("============ START ===========================\n");
                        process.stdout.write("title  = " + product_title.trim() + "\n");
                        process.stdout.write("thumbnail  = " + product_thumbnail.trim() + "\n");
                        process.stdout.write("description  = " + product_desc.trim() + "\n");
                        process.stdout.write("Price  = " + product_price + "\n");
                        process.stdout.write("Discount  = " + product_discount + "\n");
                        process.stdout.write("Discount Percent  = " + product_percent + "\n");
                        process.stdout.write("Details = " + product_detail_link + "\n");
                        process.stdout.write("============ END ===========================\n");
                  } else {
                        process.stdout.write("Skipped this HTML element\n");
                  }
            });

            // Extract data from remain pages
            if (remain_pages.length > 0 && handle_paging) {
                  var page_list = remain_pages.find(product_pattern.product_paging.page_link);
                  if (page_list.length > 0) {
                        page_list.each(function (i, page) {
                              var link = $(this).attr('href');
                              link = insert_prefix_homepage(link, cur_home_page);
                              console.log("Start Page: " + link + "");
                              extract_productlist_from_link(link, false);
                              console.log("End Page: " + link + "");
                        });
                  } else {
                        console.log("ONLY have ONE page");
                  }
            } else {

            }
      });
}

exports.init = function (crawl_pattern, orm_manager){
      g_crawl_pattern = crawl_pattern;
      g_orm_manager = orm_manager;
}

exports.crawl_alink_indepth = function (home_page, web_content) {
      // load the web_content of the page into Cheerio so we can traverse the DOM
      var $ = cheerio.load(web_content);
      var menu_item_links = [];

      var menu = $(g_crawl_pattern.product_menu.panel);
      var menu_items = menu.find(g_crawl_pattern.product_menu.item);
      cur_home_page = home_page;

      menu_items.each(function (i, product) {
            var item_link = $(this).attr("href");
            item_link = insert_prefix_homepage(item_link, cur_home_page);
            menu_item_links.push(item_link);
      });

      menu_item_links.forEach(function (link) {
            extract_productlist_from_link(link, true);
      });
}

exports.crawl_alink_nodepth = function (link){
      extract_productlist_from_link(link, true);
}
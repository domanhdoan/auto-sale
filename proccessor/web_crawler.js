require('string.prototype.startswith');
var models = require("../models/product_model.js");
var cheerio = require("cheerio");
var cur_home_page = "";

function insert_prefix_homepage(current_link, home_page) {
      if (!current_link.startsWith('http')) {
            current_link = home_page + current_link;
      }
      return current_link;
}

function load_pattern(crawl_pattern) {
      var pattern = JSON.parse(require('fs').readFileSync(crawl_pattern, 'utf8'));
      return pattern;
}

function extract_remain_pages_content(remain_pages, paging_pattern, orm_manager) {
      var page_list = remain_pages.find(paging_pattern.page_link).attr('href');
      page_list.each(function (i, product) {
            console.log("Page link: " + $(this).text());
      });
}

function extract_menu_item_link(web_content, product_pattern, orm_manager) {
      var $ = cheerio.load(web_content);
      var product_list = $(product_pattern.product_list);
      var remain_pages = $(product_pattern.product_paging.page_list);

      product_list.each(function (i, product) {
            var product_title = $(this).find(product_pattern.title).text();
            var product_thumbnail = $(this).find(product_pattern.thumbnail).attr('src');
            var product_desc = $(this).find(product_pattern.desc).text();

            if (product_thumbnail != undefined && product_title != undefined) {
                  var product_detail_link = $(this).find(product_pattern.detail_link).attr('href');
                  product_detail_link = insert_prefix_homepage(product_detail_link, cur_home_page);

                  process.stdout.write("============ START ===========================\n");

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

                  process.stdout.write("title  = " + product_title.trim() + "\n");
                  process.stdout.write("thumbnail  = " + product_thumbnail.trim() + "\n");
                  process.stdout.write("description  = " + product_desc.trim() + "\n");
                  process.stdout.write("Price  = " + product_price + "\n");
                  process.stdout.write("Discount  = " + product_discount + "\n");
                  process.stdout.write("Discount Percent  = " + product_percent + "\n");
                  process.stdout.write("Details = " + product_detail_link + "\n");

                  // var product_code = "";
                  // ProductionInfo.build({
                  //       code: product_code,
                  //       title: product_title,
                  //       thumbnail: product_thumbnail,
                  //       price: product_price,
                  //       discount: product_discount,
                  //       percent: product_percent})
                  // .save()
                  // .then(function(){
                  //       console.log("finish save file");
                  // });

                  process.stdout.write("============ END ===========================\n");
            } else {
                  process.stdout.write("Skipped this HTML element\n");
            }
      });

      // Extract data from remain pages
      if (remain_pages != undefined) {
            extract_remain_pages_content(remain_pages, product_pattern.product_info.product_paging, orm_manager);
      }
}

exports.extract_content = function (home_page, web_content, crawl_pattern, orm_manager) {
      // load the web_content of the page into Cheerio so we can traverse the DOM
      var $ = cheerio.load(web_content);
      var product_pattern = load_pattern(crawl_pattern);
      var menu_item_links = [];

      var menu = $(product_pattern.product_menu.panel);
      var menu_items = menu.find(product_pattern.product_menu.item);
      cur_home_page = home_page;

      menu_items.each(function (i, product) {
            var item_link = $(this).attr("href");
            item_link = insert_prefix_homepage(item_link, cur_home_page);
            menu_item_links.push(item_link);
      });

      menu_item_links.forEach(function (link) {
            var request = require("request");
            request(link, function (error, response, body) {
                  if (error) {
                        console.log("Couldn’t get page " + link + " because of error: " + error);
                        return;
                  }
                  console.log("Sub-category: " + link + "");
                  extract_menu_item_link(body, product_pattern.product_info, orm_manager);
            });
      });
}

function save_to_db(product_info) {

}
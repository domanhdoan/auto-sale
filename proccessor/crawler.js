var models = require("../models/product_model.js");
var cheerio = require("cheerio");
var home_page = "";

function load_pattern(crawl_pattern) {
      var pattern = JSON.parse(require('fs').readFileSync(crawl_pattern, 'utf8'));
      return pattern;
}

function extract_menu_item_link(web_content, product_pattern, orm_manager) {
      var $ = cheerio.load(web_content);
      var product_list = $(product_pattern.product_list);
      product_list.each(function (i, product) {
            var product_title = $(this).find(product_pattern.title).text();
            var product_thumbnail = $(this).find(product_pattern.thumbnail).attr('src');
            var product_desc = $(this).find(product_pattern.desc).text();

            if (product_thumbnail != undefined && product_title != undefined) {
                  process.stdout.write("============ START ===========================\n");

                  if (product_desc == "") {
                        product_desc = product_title;
                  }

                  process.stdout.write("title  = " + product_title.trim() + "\n");
                  process.stdout.write("Thumbnail  = " + product_thumbnail.trim() + "\n");
                  process.stdout.write("description  = " + product_desc.trim() + "\n");

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

                  process.stdout.write("Price  = " + product_price + "\n");
                  process.stdout.write("Discount  = " + product_discount + "\n");
                  process.stdout.write("Discount Percent  = " + product_percent + "\n");

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
}

exports.extract_webcontent = function (home_page, web_content, crawl_pattern, orm_manager) {
      // load the web_content of the page into Cheerio so we can traverse the DOM
      var $ = cheerio.load(web_content);
      var product_pattern = load_pattern(crawl_pattern);
      var menu_item_links = [];

      var menu = $(product_pattern.product_menu.panel);
      var menu_items = menu.find(product_pattern.product_menu.item);
      menu_items.each(function (i, product) {
            var item_link = $(this).attr("href");
            if (item_link.indexOf("http://") < 0) {
                  item_link = home_page + item_link;
            }
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
require('string.prototype.startswith');
var crawler 		= require("./proccessor/web_crawler.js");
var auto_sale_bot 	= require("./proccessor/customer_service_bot.js");
var orm_manager 	= require("./db_management/db_manager.js");

// var url = "http://giaynam.com/giay-buoc-day/";
// var url = "http://zeisicmienbac.com";
// var url = "https://bibomart.com.vn";
var url = "http://bluewind.vn";
var product_pattern = "";

function load_pattern(url) {
	var product_pattern = url;
	if (product_pattern.startsWith('http://')) {
		product_pattern = product_pattern.replace('http://', '');
	} else if (product_pattern.startsWith('https://')) {
		product_pattern = product_pattern.replace('https://', '');
	} else {

	}
	product_pattern = './pattern/' + product_pattern + ".json";
	var pattern = JSON.parse(require('fs').readFileSync(product_pattern, 'utf8'));
	return pattern;
}

var product_pattern = load_pattern(url);
orm_manager.init();
crawler.init(product_pattern, orm_manager);
crawler.crawl_alink_indepth(url);
auto_sale_bot.set_crawler(crawler);

auto_sale_bot.init(8000, url + '' + product_pattern.product_search);

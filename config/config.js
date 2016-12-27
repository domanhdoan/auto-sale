/*
 * Configuration options
 */

var config = {};

config.submodule = {
	crawler: false,
	salebot: false
};

config.crawler = {
	temp_dir: './temp/'
};

config.env = 'development';

config.db = {
	host: "127.0.0.1",
	db_name: "product_crawl",
	db_user: "doan",
	db_pass: "colen123",
	engine: 'mysql'
};

// AI Camera: //"324d2b5845214d5f91cc6c89b3550929",
config.bots = {
	map_key: "AIzaSyChRPQzNkcU8ULGhQTuRJhkzQURQ8nkzcY",
	map_provider: "google",
	ai_port: 7000,
	ai_token: "85845565e4634d99ae09ae0a8921e0b6",
	ai_webhook: "/joyboxws/",
	ai_lang: "en",
	ai_on: false,
	port: 5000,
	fb_webhook: "/webhook/",
	fb_verify_token: "verify_me",
	fb_page_token: "EAAZAVL7sm1s8BANL16ziFx5Jo9ubzjmt6GDAUOjauGvNRZABZC7iMki4UncSx3vYvNsgaPy9ZArlnlkVHQtYsuddGZBDSEObk9ZAOADImMcfCUN4tf7yYQuyc0xg302FhmXCWohhle3lgpI5mzLZAdXzzXxD7hvRjIFY0EHZAQpbigZDZD"
};

config.develop = {
	debug: true,
	log_path: 'auto_sale.log',
};

module.exports = config;
/*
 * Configuration options
 */

var config = {};

config.submodule = {
    crawler: true,
    salebot: false
};

config.crawler = {
    temp_dir: './temp/'
};

config.db = {
    host: "127.0.0.1",
    db_name: "product_crawl",
    db_user: "doan",
    db_pass: "colen123",
    engine: 'mysql'
};

// AI Camera: //"324d2b5845214d5f91cc6c89b3550929",
config.network = {
    ai_port: 7000,
    ai_token: "85845565e4634d99ae09ae0a8921e0b6",
    ai_webhook: "/joyboxws/",
    ai_lang: "en",
    port: 5000,
    fb_webhook: "/joyboxwebhook/",
    fb_verify_token: "verify_me",
    fb_page_token: "EAAPsuaR9aooBAFHiRys6jXnUX91lt7evfByO7Hc42qcPZBgeA3dHq18C0LvEwjuaXodnliKZAOs0RZAfxgQ6v7Q9SFhvGZCzrHalj3myhjzrtmeKfSXZCvZBaZBla0zrhvZB17Njru2p1xWgkSKmVZB59yXBFaXt9gOr6kFmAZBHukPAZDZD"
};

config.develop = {
    debug: true,
    log_path: 'auto_sale.log',
};

module.exports = config;

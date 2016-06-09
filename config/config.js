/*
 * Configuration options
 */

var config = {};

config.submodule = {
    crawler: false,
    salebot: true
};

config.crawler = {
    temp_dir: './temp'
};

config.db = {
    host: "127.0.0.1",
    db_name: "product_crawl",
    db_user: "doan",
    db_pass: "colen123",
    engine : 'mysql'
};

config.network = {
    port: 5000,
    webhook: "/joyboxwebhook/",
    fb_token: "EAAPsuaR9aooBAFHiRys6jXnUX91lt7evfByO7Hc42qcPZBgeA3dHq18C0LvEwjuaXodnliKZAOs0RZAfxgQ6v7Q9SFhvGZCzrHalj3myhjzrtmeKfSXZCvZBaZBla0zrhvZB17Njru2p1xWgkSKmVZB59yXBFaXt9gOr6kFmAZBHukPAZDZD"
};

config.develop = {
    debug: true,
    log_path: 'auto_sale.log',
};

module.exports = config;

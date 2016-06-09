/*
 * Configuration options
 */

var config = {};

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
    webhook: "/joyboxwebhook/"
};

config.develop = {
    debug: true,
    log_path: 'auto_sale.log',
};

module.exports = config;

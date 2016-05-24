var g_orm_manager = null;
var g_web_crawler = null;
var logger = require("../util/logger.js");

exports.init = function (orm_manager, web_crawler) {
    g_orm_manager = orm_manager;
    g_web_crawler = web_crawler;
}

exports.findAllCategories = function (store_name, callback) {
    g_orm_manager.Store.findAll({
        where: {
            home: store_name
        }
    }).then(function (store) {
        if(store.length == 1){
            g_orm_manager.Category.findAll({
                where: {
                    StoreId: store[0].dataValues.id
                }
            }).then(function (categories) {
                categories.forEach(function (category) {
                    logger.info(category.name);
                });
                if(callback != null){
                    
                }
            });
        }else{
            
        }
    });
}

exports.findCategoriesByName = function (store_name, keyword) {
}

exports.findProductsByKeywords = function (search_path, keywords, callback) {
    g_web_crawler.crawl_alink_nodepth(search_path+""+keywords, callback);    
}

exports.findProductsByImage = function (image_path, callback) {
    // Send request to google image seach engine
    // var giSearch = require('google-image-search');
    // giSearch('logo google').pipe(fs.createWriteStream(image_path));
}

exports.findProductsByThumbnail = function (thumbnail_link, callback) {
    g_orm_manager.Product.findAll({
        where: {
            thumbnail: thumbnail_link.replaceAll('-', '%%')
        }
    }).then(function (products) {
        if (products.length >= 1) {
            logger.info(products[0].dataValues.title);
        } else {
            logger.debug("Product not found");
        }
    });
}
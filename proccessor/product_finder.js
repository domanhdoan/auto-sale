var g_orm_manager = null;
var g_web_crawler = null;
var logger = require("../util/logger.js");

exports.init = function (orm_manager, web_crawler) {
    g_orm_manager = orm_manager;
    g_web_crawler = web_crawler;
}

exports.findStoreByLink = function (link, callback) {
    g_orm_manager.Store.findOne({
        where: {
            home: link
        }
    }).then(function (store) {
        callback(store);
    });
}

exports.findCategoriesByStoreId = function (store_id, callback) {
    g_orm_manager.Category.findAll({
        where: {
            StoreId: store_id
        }
    }).then(function (categories) {
        if (callback != null) {
            callback(categories);
        } else {

        }
    });
}

exports.findCategoriesByName = function (store_name, keyword) {
}

exports.findProductsByKeywords = function (search_path, keywords, callback) {
    //g_web_crawler.crawl_alink_nodepth(search_path + "" + keywords, callback);
    g_orm_manager.Product.findAll({
        where: {
            link: {
                $like: "%" + keywords + "%"
            }
        }
    }).then(function (products) {
        callback(products);
    });
}

// exports.findProductsByKeywords = function (search_path, keywords, callback) {
//     g_web_crawler.crawl_alink_nodepth(search_path + "" + keywords, callback);
// }

exports.findProductsByCategory = function (home_page, category_name, callback) {
    g_orm_manager.Category.findOne({
        where: {
            name: {
                $like: "%" + code + "%"
            }
        }
    }).then(function (product) {
        if (product != null) {
            logger.info(product.dataValues.title);
            callback(product);
        } else {
            logger.debug("Product not found");
        }
    });
}

exports.findProductsByCode = function (code, callback) {
    g_orm_manager.Product.findOne({
        where: {
            title: {
                $like: "%" + code + "%"
            }
        }
    }).then(function (product) {
        callback(product);
    });
}

exports.findProductsByImage = function (image_path, callback) {
    // Send request to google image seach engine
    // var giSearch = require('google-image-search');
    // giSearch('logo google').pipe(fs.createWriteStream(image_path));
}

exports.findProductByThumbnail = function (thumbnail_link, callback) {
    g_orm_manager.Product.findOne({
        where: {
            thumbnail: thumbnail_link.replaceAll('-', '%%')
        }
    }).then(function (product) {
        if (product != null) {
            logger.info(products[0].dataValues.title);
            callback(product);
        } else {
            logger.debug("Product not found");
        }
    });
}

exports.getProductColors = function (product_id, callback) {
    g_orm_manager.Color.findAll({
        where: {
            ProductId: product_id
        }
    }).then(function (colors) {
        callback(colors);
    });
}

exports.getProductSizes = function (product_id, callback) {
    g_orm_manager.Size.findAll({
        where: {
            ProductId: product_id
        }
    }).then(function (sizes) {
        callback(sizes);
    });
}

exports.checkProductByColor = function (product_id, color, callback) {
    g_orm_manager.Color.findOne({
        where: {
            name: color,
            ProductId: product_id
        }
    }).then(function (color) {
        callback(color);
    });
}

exports.checkProductBySize = function (product_id, size, callback) {
    g_orm_manager.Size.findOne({
        where: {
            value: size,
            ProductId: product_id
        }
    }).then(function (size) {
        callback(size);
    });
}
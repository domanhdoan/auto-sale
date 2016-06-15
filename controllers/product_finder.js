var g_orm_manager = null;
var g_web_crawler = null;

var logger = require("../util/logger.js");
const common = require('../util/common.js');

//===================================================//
//================= SHOE finding ====================//
//===================================================//
var keywords = ['giay', 'mau', 'size'];
function parse_keywords(keywords, word_list) {
    var result = {};
    var temp = '';
    var last_keyword = null;
    for (var i = 0; i <= word_list.length; i++) {
        if (keywords.indexOf(word_list[i]) >= 0 || i == word_list.length) {
            if (last_keyword != null) {
                console.log("key = " + last_keyword + " value = " + temp);
                result[last_keyword] = temp.trim();
                temp = '';
            }else{
                result['giay'] = temp.trim();
            }
            last_keyword = word_list[i];
        } else {
            temp += " " + word_list[i];
        }
    }
    return result;
}
function parse_keywords_calibration(keywords, word_list) {
    var results_json = parse_keywords(keywords, word_list);
    var results = [];

    if (results_json['giay'] != null) {
        results_json['giay'] = results_json['giay'].replaceAll(" ", "%%");
    } else {
        results_json['giay'] = "";
    }

    if (results_json['mau'] != null) {
        results_json['mau'] = results_json['mau'].replaceAll(" ", "");
    } else {
        results_json['mau'] = "";
    }

    if (results_json['size'] == null) {
        results_json['size'] = "";
    }

    results.push(results_json['giay']);
    results.push(results_json['mau']);
    results.push(common.extract_numeric(results_json['size']));

    return results;
}

function generate_query_findshoes(keywords) {
    var query = " Select DISTINCT P.id, P.title, P.price, P.thumbnail, P.code, P.link"
        + " from product as P";
    if (keywords[1].length > 0) {
        query += " inner join color as C on P.id = C.ProductId"
    }
    if (keywords[2].length > 0) {
        query += " inner join size as S on P.id = S.ProductId";
    }
    query += " where P.link like '%" + keywords[0] + "%'";
    if (keywords[1].length > 0) {
        query += " and C.name = '" + keywords[1] + "'"
    }
    if (keywords[2].length > 0) {
        query += " and S.value = '" + keywords[2] + "'";
    }
     query += " LIMIT " + common.product_search_max + ";";
        
    return query;
}

function generate_query_findcolorNsize(product_id) {
    var query = " Select DISTINCT C.name, S.value"
        + " from product as P";
    query += " inner join color as C on P.id = C.ProductId"
    query += " inner join size as S on P.id = S.ProductId";
    query += " where P.id = " + product_id + "";    
    return query;
}
//===================================================//
//===================================================//

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
            logger.info(" NO Cagegory");
        }
    });
}

exports.findInvoiceById = function (invoice_id, callback) {
    g_orm_manager.Invoice.findOne({
        where: {
            id: invoice_id
        }
    }).then(function (invoice) {
        callback(invoice);
    });
}

// Keyword order: shoes -> color -> size
exports.findShoesByKeywords = function (user_message, callback) {
    var products = [];
    var word_list = user_message.split(" ");
    var keywords_value = parse_keywords_calibration(keywords, word_list);
    var count = Object.keys(keywords_value).length;
    if (count != 0) {
        var query = generate_query_findshoes(keywords_value);
        g_orm_manager.sequelize.query(query)
            .spread(function (results, metadata) {
                if (results == null) {
                    logger.error("Product not found");
                    callback(products);
                } else {
                    logger.info(results.length);
                    callback(results);
                }
            });
    } else {
        callback(products);
    }

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

exports.findProductByFinger = function (finger, callback) {
    g_orm_manager.Product.findOne({
        where: {
            finger: finger
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

exports.findProductByThumbnail = function (home_page, thumbnail_link, callback) {
    require('../controllers/web_crawler').extract_product_thumb_link(
            home_page, thumbnail_link, function (real_thumb_url) {
        logger.info("search_item URL = " + real_thumb_url);
        g_orm_manager.Product.findOne({
            where: {
                thumbnail: real_thumb_url.replaceAll('-', '%%')
            }
        }).then(function (product) {
            if (product != null) {
                logger.info(product.dataValues.title);
                callback(product);
            } else {
                logger.debug("Product not found");
            }
        });
    });
}

exports.getColorsNSize = function (product_id, callback){
    module.exports.getProductColors(product_id, function(colors){
        module.exports.getProductSizes(product_id, function(sizes){
            callback(colors, sizes);
        });
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
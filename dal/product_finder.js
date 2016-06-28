var gDbManager = require("../models/db_manager.js");

var logger = require("../util/logger.js");
var common = require('../util/common.js');

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
            } else {
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

function generateFindshoesQuery(storeId, keywords) {
    var query = " Select DISTINCT P.id, P.title, P.price, P.thumbnail, P.code, P.link" + " from product as P";
    if (keywords[1].length > 0) {
        query += " inner join color as C on P.id = C.ProductId"
    }
    if (keywords[2].length > 0) {
        query += " inner join size as S on P.id = S.ProductId";
    }
    query += " where P.StoreId = '" + storeId + "'and P.link like '%" + keywords[0] + "%'";
    if (keywords[1].length > 0) {
        query += " and C.name = '" + keywords[1] + "'"
    }
    if (keywords[2].length > 0) {
        query += " and S.value = '" + keywords[2] + "'";
    }
    query += " order by P.id ASC LIMIT " + common.product_search_max + ";";

    return query;
}

function converDBObjectToJson(object) {
    var jsonObj = null;
    if (Array.isArray(object)) {
        jsonObj = [];
        for (var i = 0, length = object.length; i < length; i++) {
            jsonObj.push(object[i].dataValues);
        }
    } else {
        jsonObj = (object != null) ? object.dataValues : {};
    }
    return jsonObj;
}

//===================================================//
//===================================================//

exports.findStoreByLink = function(link, callback) {
    gDbManager.Store.findOne({
        where: {
            home: link
        }
    }).then(function(store) {
        var jsonObj = converDBObjectToJson(store);
        callback(jsonObj);
    });
}

exports.findCategoriesByStoreId = function(storeid, callback) {
    gDbManager.Category.findAll({
        where: {
            StoreId: storeid
        }
    }).then(function(categories) {
        var jsonObj = converDBObjectToJson(categories);
        callback(jsonObj);
    });
}

exports.findInvoiceById = function(invoice_id, callback) {
    gDbManager.Invoice.findOne({
        where: {
            id: invoice_id
        }
    }).then(function(invoice) {
        callback(invoice);
    });
}

// Keyword order: shoes -> color -> size
exports.findShoesByKeywords = function(storeId, user_message, callback) {
    var products = [];
    var word_list = user_message.split(" ");
    var keywords_value = parse_keywords_calibration(keywords, word_list);
    var count = Object.keys(keywords_value).length;
    if (count != 0) {
        var query = generateFindshoesQuery(storeId, keywords_value);
        gDbManager.sequelize.query(query)
            .spread(function(results, metadata) {
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

exports.findProductsById = function(id, callback) {
    gDbManager.Product.findOne({
        where: {
            id: id
        }
    }).then(function(product) {
        callback(product);
    });
}

exports.findProductByCode = function(storeId, code, callback) {
    gDbManager.Product.findOne({
        where: {
            title: {
                $like: "%" + code + "%"
            },
            StoreId: storeId
        }
    }).then(function(product) {
        var jsonObj = converDBObjectToJson(product);
        callback(jsonObj);
    });
}

exports.findProductByThumbnail = function(home_page, thumbnail_link, callback) {
    require('../processors/web_scraping').extractThumbUrl(
        home_page, thumbnail_link,
        function(real_thumb_url) {
            logger.info("search_item URL = " + real_thumb_url);
            gDbManager.Product.findOne({
                where: {
                    thumbnail: real_thumb_url.replaceAll('-', '%%')
                }
            }).then(function(product) {
                if (product != null) {
                    var jsonObj = converDBObjectToJson(product);
                    callback(jsonObj);
                } else {
                    logger.debug("Product not found");
                }
            });
        });
}

exports.findProductsByCategory = function(storeId, categoryId, callback) {
    gDbManager.Product.findAll({
        order: [
            ['id', 'ASC']
        ],
        where: {
            CategoryId: categoryId,
            StoreId: storeId
        }
    }).then(function(products) {
        var jsonObj = converDBObjectToJson(products);
        callback(jsonObj);
    });
}

exports.findProductsByPriceRange = function(storeId, priceMin, priceMax, callback) {
    gDbManager.Product.findAll({
        order: [
            ['price', 'ASC']
        ],
        where: {
            CategoryId: categoryId,
            StoreId: storeId
        }
    }).then(function(products) {
        var jsonObj = converDBObjectToJson(products);
        callback(jsonObj);
    });
}

exports.findProductPhotos = function(productid, callback) {
    gDbManager.ProductPhoto.findAll({
        where: {
            ProductId: productid
        }
    }).then(function(photos) {
        var jsonObj = converDBObjectToJson(photos);
        callback(jsonObj);
    });
}

exports.getColorsNSizeNPhotos = function(productid, callback) {
    module.exports.getProductColors(productid, function(colors) {
        module.exports.getProductSizes(productid, function(sizes) {
            module.exports.findProductPhotos(productid, function(photos) {
                callback(colors, sizes, photos);
            });
        });
    });
}

exports.getProductColors = function(product_id, callback) {
    gDbManager.Color.findAll({
        order: [
            ['value', 'ASC']
        ],
        where: {
            ProductId: product_id
        }
    }).then(function(colors) {
        var jsonColorObj = converDBObjectToJson(colors);
        callback(jsonColorObj);
    });
}

exports.getProductSizes = function(product_id, callback) {
    gDbManager.Size.findAll({
        order: [
            ['value', 'ASC']
        ],
        where: {
            ProductId: product_id
        }
    }).then(function(sizes) {
        var jsonSizeObj = converDBObjectToJson(sizes);
        callback(jsonSizeObj);
    });
}

exports.checkProductByColor = function(product_id, color, callback) {
    gDbManager.Color.findOne({
        where: {
            name: color,
            ProductId: product_id
        }
    }).then(function(color) {
        var jsonColorObj = converDBObjectToJson(color);
        callback(jsonColorObj);
    });
}

exports.checkProductBySize = function(product_id, size, callback) {
    gDbManager.Size.findOne({
        where: {
            value: size,
            ProductId: product_id
        }
    }).then(function(size) {
        var jsonSizeObj = converDBObjectToJson(size);
        callback(jsonSizeObj);
    });
}

exports.getOrderItems = function(invoice_id, callback) {
    gDbManager.FashionItem.findAll({
        attributes: ['quantity'],
        order: [
            ['id', 'ASC']
        ],
        where: {
            InvoiceId: invoice_id
        },
        include: [{
            model: gDbManager.Product,
            attributes: ['title', 'desc', 'thumbnail', 'price', 'discount'],
            where: {
                id: gDbManager.sequelize.col('FashionItem.ProductId')
            }
        }, {
            model: gDbManager.Color,
            where: {
                id: gDbManager.sequelize.col('FashionItem.ProductId')
            }
        }, {
            model: gDbManager.Size,
            where: {
                id: gDbManager.sequelize.col('FashionItem.ProductId')
            }
        }, {
            model: gDbManager.Invoice,
            where: {
                id: gDbManager.sequelize.col('FashionItem.ProductId')
            }
        }]
    }).then(function(items) {
        callback(items);
    });
}
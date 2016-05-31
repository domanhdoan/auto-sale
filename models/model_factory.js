var g_orm_manager = null;
var logger = require('../util/logger.js');

module.exports.init = function (orm_manager){
    g_orm_manager = orm_manager;
}

module.exports.create_category = function(store_object, name, callback){
    g_orm_manager.Category.findOne({
        where: {
            name: name,
            StoreId: store_object.id
        }
    }).then(function (result) {
        if (result == null) {
            g_orm_manager.Category
                .build({
                    name: name,
                })
                .save()
                .then(function (saved_category) {
                    saved_category.setStore(store_object);
                    callback(saved_category);
                    // extract_productlist_from_link(store_object, saved_category,
                    //     item_link, true, true, null);
                }).catch(function (error) {
                    logger.error(error);
                });

        } else {
            callback(result);
        }
    });
}

module.exports.create_product = function (
    saved_store,
    saved_category,
    product_title,
    product_thumbnail,
    product_desc,
    product_price,
    product_discount,
    product_percent,
    product_detail_link,
    product_finger,
    product_brand,
    callback
) {
    g_orm_manager.Product
        .build({
            title: product_title,
            thumbnail: product_thumbnail.replaceAll('-', '%%'),
            desc: product_desc,
            price: product_price,
            discount: product_discount,
            percent: product_percent,
            link: product_detail_link.replaceAll('-', '%%'),
            finger: product_finger,
            brand: product_brand
        }).save()
        .then(function (saved_product) {
            logger.info(" Save new product successfully");
            saved_product.setCategory(saved_category);
            saved_product.setStore(saved_store);
            if (saved_category.cover == null) {
                saved_category.updateAttributes({
                    cover: saved_product.thumbnail.replaceAll("%%", "-")
                });
            }
            callback(saved_product);
        }).catch(function (error) {
            logger.error(error);
        });
}

module.exports.create_product_color = function (saved_product, color_name,
    color_value, callback) {
    g_orm_manager.Color.findOne({
        where: {
            ProductId: saved_product.dataValues.id
        }
    }).then(function (result) {
        if (result == null) {
            g_orm_manager.Color
                .build({
                    name: color_name,
                    value: color_value
                })
                .save()
                .then(function (saved_color) {
                    saved_color.setProduct(saved_product);
                    callback(saved_color);
                }).catch(function (error) {
                    logger.error(error);
                });

        } else {
            callback(result);
        }
    });
}

module.exports.create_product_size = function (saved_product, size, callback) {
    g_orm_manager.Size.findOne({
        where: {
            ProductId: saved_product.dataValues.id
        }
    }).then(function (result) {
        if (result == null) {
            g_orm_manager.Size
                .build({
                    value: size
                })
                .save()
                .then(function (saved_size) {
                    saved_size.setProduct(saved_product);
                    callback(saved_size);
                }).catch(function (error) {
                    logger.error(error);
                });

        } else {
            callback(result);
        }
    });
}
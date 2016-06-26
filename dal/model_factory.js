var gDbManager = require("../models/db_manager.js");
var logger = require('../util/logger.js');
var moment = require('moment');
var common = require('../util/common.js');

module.exports.findAndCreateStore = function(store_page, store_type, callback) {
    gDbManager.Store.findOrCreate({
        where: {
            home: store_page
        },
        defaults: {
            home: store_page,
            type: store_type
        }
    }).then(function(store) {
        var saved_store = store[0];
        callback(saved_store);
    });
}

module.exports.findAndCreateCategory = function(store_object, name, link, callback) {
    gDbManager.Category.findOrCreate({
        where: {
            name: name,
            StoreId: store_object.id
        },
        defaults: {
            name: name,
            link: link
        }
    }).then(function(category) {
        var saved_category = category[0];
        saved_category.setStore(store_object);
        callback(saved_category);
    });
}

module.exports.findAndCreateProduct = function(
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
    product_code_pattern,
    callback
) {
    // result = common.extract_product_code(product_detail_link, product_code_pattern);
    // g_orm_manager.Product.findOrCreate({
    //     where: {
    //         link: product_detail_link.replaceAll('-', '%%')
    //     },
    //     defaults: {
    //         title: product_title,
    //         thumbnail: product_thumbnail.replaceAll('-', '%%'),
    //         desc: product_desc,
    //         price: product_price,
    //         discount: product_discount,
    //         percent: product_percent,
    //         link: product_detail_link.replaceAll('-', '%%'),
    //         finger: product_finger,
    //         brand: product_brand
    //     }
    // }).then(function (product) {
    //     var saved_product = product[0];
    //     logger.info("Save new product successfully");
    //     saved_product.setCategory(saved_category);
    //     saved_product.setStore(saved_store);
    //     if (saved_category.cover == null) {
    //         saved_category.updateAttributes({
    //             cover: saved_product.thumbnail.replaceAll("%%", "-")
    //         });
    //     }
    //     callback(saved_product);
    // });

    gDbManager.Product.findOne({
        where: {
            link: product_detail_link.replaceAll('-', '%%')
        }
    }).then(function(found_product) {
        if (found_product == null) {
            gDbManager.Product
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
                })
                .save().then(function(saved_product) {
                    saved_product.setCategory(saved_category);
                    saved_product.setStore(saved_store);
                    if (saved_category.cover == null) {
                        saved_category.updateAttributes({
                            cover: saved_product.thumbnail.replaceAll("%%", "-")
                        });
                    }
                    callback(saved_product);
                });
        } else {
            callback(found_product);
        }
    });
}

module.exports.create_product_color = function(saved_product, color_name,
    color_value, callback) {
    gDbManager.Color.findOne({
        where: {
            name: color_name,
            ProductId: saved_product.dataValues.id
        }
    }).then(function(result) {
        if (result == null) {
            gDbManager.Color
                .build({
                    name: color_name,
                    value: color_value
                })
                .save()
                .then(function(saved_color) {
                    saved_color.setProduct(saved_product);
                    callback(saved_color);
                }).catch(function(error) {
                    logger.error(error);
                });

        } else {
            callback(result);
        }
    });
}

module.exports.create_product_size = function(saved_product, size, callback) {
    gDbManager.Size.findOne({
        where: {
            value: size,
            ProductId: saved_product.dataValues.id
        }
    }).then(function(result) {
        if (result == null) {
            gDbManager.Size
                .build({
                    value: size
                })
                .save()
                .then(function(saved_size) {
                    saved_size.setProduct(saved_product);
                    callback(saved_size);
                }).catch(function(error) {
                    logger.error(error);
                });

        } else {
            callback(result);
        }
    });
}

module.exports.create_empty_invoice = function(fbid, callback) {
    gDbManager.Invoice
        .build({
            fbid: fbid,
            creation_date: moment.now(),
            status: "created"
        })
        .save()
        .then(function(saved_invoice) {
            callback(saved_invoice);
        }).catch(function(error) {
            logger.error(error);
        });
}

module.exports.cancel_invoice = function(id, status, callback) {
    gDbManager.Invoice.findOne({
        where: {
            id: id
        }
    }).then(function(invoice) {
        if (invoice) { // if the record exists in the db
            invoice.updateAttributes({
                status: "cancel"
            });
        } else {}
        callback(invoice);
    })
}

module.exports.update_invoice = function(invoice_info, callback) {
    gDbManager.Invoice.findOne({
        where: {
            id: invoice_info.id
        }
    }).then(function(invoice) {
        if (invoice) { // if the record exists in the db
            invoice.updateAttributes({
                name: invoice_info.name,
                phone: invoice_info.phone,
                address: invoice_info.address,
                email: invoice_info.email,
                plan_delivery_date: invoice_info.delivery,
                status: invoice_info.status
            });
        } else {}
        callback(callback);
    })
}

module.exports.create_fashion_item = function(quantity, saved_invoice,
    saved_product, saved_color, saved_size, callback) {
    gDbManager.FashionItem
        .build({
            quantity: quantity,
            InvoiceId: saved_invoice,
            ProductId: saved_product,
            ColorId: saved_color,
            SizeId: saved_size
        })
        .save()
        .then(function(saved_item) {
            callback(saved_item);
        }).catch(function(error) {
            logger.error(error);
        });
}
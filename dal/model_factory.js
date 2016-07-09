var gDbManager = require("../models/db_manager.js");
var logger = require('../util/logger.js');
var moment = require('moment');
var common = require('../util/common.js');
var crypto = require('crypto');

module.exports.findAndCreateStore = function(homepage, type, callback) {
    gDbManager.Store.findOrCreate({
        where: {
            home: homepage
        },
        defaults: {
            home: homepage,
            type: type
        }
    }).then(function(store) {
        var savedStore = store[0];
        callback(savedStore);
    });
}

module.exports.findAndCreateCategory = function(savedStore, name, link, callback) {
    gDbManager.Category.findOrCreate({
        where: {
            name: name,
            StoreId: savedStore.id
        },
        defaults: {
            name: name,
            link: link
        }
    }).then(function(category) {
        var savedCategory = category[0];
        savedCategory.setStore(savedStore);
        callback(savedCategory);
    });
}

module.exports.findAndCreateProduct = function(
    saved_store, savedCategory, product_title,
    product_thumbnail, product_desc, product_price,
    product_discount, product_percent, product_detail_link,
    product_type, product_finger, product_code, callback
) {
    // var product_finger = require('crypto').createHmac('sha256', product_detail_link)
    //     .digest('hex');
    gDbManager.Product.findOrCreate({
        where: {
            link: product_detail_link.replaceAll('-', '%%')
        },
        defaults: {
            title: product_title,
            thumbnail: product_thumbnail.replaceAll('-', '%%'),
            desc: product_desc,
            price: product_price,
            discount: product_discount,
            percent: product_percent,
            link: product_detail_link.replaceAll('-', '%%'),
            finger: product_finger,
            brand: "",
            type: product_type,
            code: product_code,
        }
    }).then(function(product) {
        var savedProduct = product[0];

        savedProduct.setCategory(savedCategory);
        savedProduct.setStore(saved_store);
        if (!product[1]) {
            if (savedCategory.cover == null) {
                savedCategory.updateAttributes({
                    cover: savedProduct.thumbnail.replaceAll("%%", "-")
                });
            }
            savedProduct.updateAttributes({
                title: product_title,
                thumbnail: product_thumbnail.replaceAll('-', '%%'),
                desc: product_desc,
                price: product_price,
                discount: product_discount,
                percent: product_percent,
                link: product_detail_link.replaceAll('-', '%%'),
                finger: product_finger,
                brand: "",
                type: product_type,
                code: product_code
            });
        }
        logger.info("Save new product successfully");
        callback(savedProduct);
    });
}

module.exports.findAndCreateProductColor = function(saved_product, color_name,
    color_value, callback) {
    gDbManager.Color.findOrCreate({
        where: {
            name: color_name,
            ProductId: saved_product.dataValues.id
        },
        defaults: {}
    }).then(function(result) {
        var saved_color = result[0];
        callback(saved_color);
    }).catch(function(error) {
        logger.error(error);
    });
}

module.exports.findAndCreateProductPhoto = function(savedStore, savedProduct,
    link, isThumbFlag, callback) {

    gDbManager.ProductPhoto.findOrCreate({
        where: {
            link: link
        },
        defaults: {
            link: link,
            thumbFlag: isThumbFlag
        }
    }).then(function(photo) {
        var savedPhoto = photo[0];
        savedPhoto.setProduct(savedProduct);
        savedPhoto.setStore(savedStore);
        logger.info(JSON.stringify(savedProduct));
        callback();
    });
}

module.exports.findAndCreateProductSize = function(saved_product, size, callback) {
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

module.exports.createInitialInvoice = function(fbid, callback) {
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

module.exports.cancelInvoice = function(id, status, callback) {
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

module.exports.createFashionOrderItem = function(quantity, saved_invoice,
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
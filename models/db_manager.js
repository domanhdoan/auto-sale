"use strict";
var fs = require("fs");
var path = require("path");
var Sequelize = require("sequelize");
var config = require("../config/config.js");
var logger  = require("../util/logger.js");

var sequelize = new Sequelize(
    config.db.db_name, 
    config.db.db_user, 
    config.db.db_pass, 
    {
        host: config.db.host,
        dialect: config.db.engine,
        freezeTableName: true,
        define: {
            timestamps: false
        },
        pool: {
            max: 20,
            min: 0,
            idle: 10000
        },
        logging: logger.info
});

var db = {};

fs.readdirSync(__dirname).filter(function (file) {
    return (file.indexOf(".") !== 0) && (file !== "db_manager.js") 
        && (file !== "model_factory.js") && (file !== "product_finder.js");
}).forEach(function (file) {
    var model = sequelize["import"](path.join(__dirname, file));
    if (model != null) {
        db[model.name] = model;
    }else{
        logger.warn("Not import empty model");
    }
});

Object.keys(db).forEach(function (modelName) {
    if ("associate" in db[modelName]) {
        db[modelName].associate(db);
    }
});

//Define relation for Category
db.Store.hasMany(db.Category, { as: "Store", foreignKeyConstraint:true});
db.Category.belongsTo(db.Store);

//Define relation for Product
db.Store.hasMany(db.Product, { as: "Store", foreignKeyConstraint:true});
db.Product.belongsTo(db.Store);
db.Category.hasMany(db.Product, { as: "Category", foreignKeyConstraint:true});
db.Product.belongsTo(db.Category);

//Define relation for ProductDetails
// db.Product.hasMany(db.FashionProductDetails, { as: "Product", foreignKeyConstraint:true});
// db.Color.hasMany(db.FashionProductDetails, { as: "Color", foreignKeyConstraint:true});
// db.Size.hasMany(db.Product, { as: "Size", foreignKeyConstraint:true});
// db.FashionProductDetails.belongsTo(db.Product);
// db.FashionProductDetails.belongsTo(db.Color);
// db.Product.belongsTo(db.Size);

db.Product.hasMany(db.Color, { as: "Product", foreignKeyConstraint:true});
db.Product.hasMany(db.Size, { as: "Product", foreignKeyConstraint:true});
db.Color.belongsTo(db.Product);
db.Size.belongsTo(db.Product);
// db.Color.sync({force: true});
// db.Size.sync({force: true});

db.Product.hasMany(db.ProductPhoto, { as: "Product", foreignKeyConstraint:true});
db.ProductPhoto.belongsTo(db.Product);

db.Color.hasMany(db.FashionItem, { as: "Color", foreignKeyConstraint:true});
db.Size.hasMany(db.FashionItem, { as: "Size", foreignKeyConstraint:true});
db.Product.hasMany(db.FashionItem, { as: "Product", foreignKeyConstraint:true});
db.Invoice.hasMany(db.FashionItem, { as: "Invoice", foreignKeyConstraint:true});
db.FashionItem.belongsTo(db.Color);
db.FashionItem.belongsTo(db.Size);
db.FashionItem.belongsTo(db.Product);
db.FashionItem.belongsTo(db.Invoice);

db.sequelize = sequelize;
db.Sequelize = Sequelize;
//This piece of code will reset DB each startup time
// db.sequelize
//     .sync({ force: true })
//     .then(function () { 
//     })
//     .catch(function (error) {
//         console.log('Unable to connect to the database: ', error);
//     });
module.exports = db;
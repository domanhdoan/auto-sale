"use strict";
var logger = require("../util/logger.js");
var fs = require("fs");
var path = require("path");
var Sequelize = require("sequelize");

var sequelize = new Sequelize('product_crawl', 'doan', 'colen123', {
    host: '127.0.0.1',
    dialect: 'mysql',
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
    return (file.indexOf(".") !== 0) && (file !== "db_manager.js") && (file !== "index.js");
}).forEach(function (file) {
    var model = sequelize["import"](path.join(__dirname, file));
    db[model.name] = model;
});

Object.keys(db).forEach(function (modelName) {
    if ("associate" in db[modelName]) {
        db[modelName].associate(db);
    }
});

db.Store.hasMany(db.Category, { as: "Store", foreignKeyConstraint:true});
db.Category.belongsTo(db.Store);
db.Store.hasMany(db.Product, { as: "Store", foreignKeyConstraint:true});
db.Product.belongsTo(db.Store);

db.Category.hasMany(db.Product, { as: "Category", foreignKeyConstraint:true});
db.Product.belongsTo(db.Category);

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
'use strict'
var fs = require('fs')
var path = require('path')
var Sequelize = require('sequelize')
var config = require('../config/config.js')
var logger = require('../util/logger.js')

var sequelize = new Sequelize(
  config.db.db_name,
  config.db.db_user,
  config.db.db_pass, {
    host: config.db.host,
    dialect: config.db.engine,
    define: {
      freezeTableName: true,
      timestamps: false,
      charset: 'utf8',
      collate: 'utf8_general_ci'
    },
    dialectOptions: {
      charset: 'utf8mb4'
    },
    pool: {
      max: 20,
      min: 0,
      idle: 10000
    },
    logging: logger.info
  })

var db = {}

fs.readdirSync(__dirname).filter(function (file) {
  return (file.indexOf('.') !== 0) && (file !== 'db_manager.js')
  && (file !== 'model_factory.js') && (file !== 'product_finder.js')
}).forEach(function (file) {
  var model = sequelize['import'](path.join(__dirname, file))
  if (model != null) {
    db[model.name] = model
  } else {
    logger.warn('Not import empty model')
  }
})

Object.keys(db).forEach(function (modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db)
  }
})

// Define relation for Category
db.Store.hasMany(db.Category, {
  as: 'Store',
  foreignKeyConstraint: true
})
db.Category.belongsTo(db.Store)

db.Store.hasMany(db.Page, {
  as: 'Store',
  foreignKeyConstraint: true
})
db.Page.belongsTo(db.Store)

// Define relation for Product
db.Store.hasMany(db.Product, {
  as: 'Store',
  foreignKeyConstraint: true
})
db.Product.belongsTo(db.Store)
db.Category.hasMany(db.Product, {
  as: 'Category',
  foreignKeyConstraint: true
})
db.Product.belongsTo(db.Category)

db.Product.hasMany(db.Color, {
  as: 'Product',
  foreignKeyConstraint: true
})
db.Product.hasMany(db.Size, {
  as: 'Product',
  foreignKeyConstraint: true
})
db.Color.belongsTo(db.Product)
db.Size.belongsTo(db.Product)
// db.Color.sync({force: true})
// db.Size.sync({force: true})

db.Product.hasMany(db.ProductPhoto, {
  as: 'Product',
  foreignKeyConstraint: true
})
db.ProductPhoto.belongsTo(db.Product)
db.Store.hasMany(db.ProductPhoto, {
  as: 'Store',
  foreignKeyConstraint: true
})
db.ProductPhoto.belongsTo(db.Store)

db.Color.hasMany(db.FashionItem, {
  as: 'Color',
  foreignKeyConstraint: true
})
db.Size.hasMany(db.FashionItem, {
  as: 'Size',
  foreignKeyConstraint: true
})
db.Product.hasMany(db.FashionItem, {
  as: 'Product',
  foreignKeyConstraint: true
})
db.Invoice.hasMany(db.FashionItem, {
  as: 'Invoice',
  foreignKeyConstraint: true
})
db.FashionItem.belongsTo(db.Color)
db.FashionItem.belongsTo(db.Size)
db.FashionItem.belongsTo(db.Product)
db.FashionItem.belongsTo(db.Invoice)

db.sequelize = sequelize
db.Sequelize = Sequelize

sequelize.sync().done(function () {
  db.Product.addFullTextIndex()
  var initdata =
  {
    'stores': [
      'http://giaytot.com',
      'http://bluewind.vn'
    ],
    'pages': [
      {
        'url': 'http://bluewind.vn',
        'name': 'Bluewind - giẩy đôi',
        'pageId': '1622583457969907',
        'token': 'EAAPsuaR9aooBAO9S7RJ2yIAdl9EIfVH4HjETVvbjfAnHBF0FCVj9qqp57jpKQ4ZAd48E20QaYWLWsyveBSjVMV5uvjCHQHuJCwavXDSIFW0RHxJoxLCTGgOx0MkuyyI2ZAmHRS4lgTmtGBffH8asfBZBSmc8tLAMY9x6DdCAgZDZD'
      },
      {
        'url': 'http://giaytot.com',
        'name': 'Giầy tốt',
        'pageId': '1622583457969908',
        'token': 'EAAPsuaR9aooBAFHiRys6jXnUX91lt7evfByO7Hc42qcPZBgeA3dHq18C0LvEwjuaXodnliKZAOs0RZAfxgQ6v7Q9SFhvGZCzrHalj3myhjzrtmeKfSXZCvZBaZBla0zrhvZB17Njru2p1xWgkSKmVZB59yXBFaXt9gOr6kFmAZBHukPAZDZD'
      }
    ]
  }
  var async = require('async')
  var gProductFinder = require('../dal/product_finder')
  var gModelfatory = require('../dal/model_factory')
  var allStoreInfo = [];
  async.series([
      function loadAllStoreInfo(callback) {
          var count = 0;
          var callbackFunc = null;
          async.eachSeries(initdata.stores, function (url, callback2) {
              gProductFinder.findStoreByLink(url, function (store) {
                  var storeId = store.id;
                  logger.info('Store ID = ' + storeId);
                  allStoreInfo[store.home] = store;
                  callback2();
                  if (count === (initdata.stores.length - 1)) {
                      callbackFunc(null);
                  }
                  count++;
              });
          });
          callbackFunc = callback;
      },
      function loadAllPageInfo() {
          async.eachSeries(initdata.pages, function (pageInfo, callback) {
              var storeObj = allStoreInfo[pageInfo.url];
              gModelfatory.findAndCreatePage(storeObj, pageInfo.name, pageInfo.pageId, pageInfo.token,
                  function (page) {
                      logger.info('Page = ' + JSON.stringify(page));
                      callback();
                  });
          });
      }
  ])
})

module.exports = db

var g_orm_manager = null;
var logger = require("../util/logger.js");

exports.init = function (orm_manager) {
    g_orm_manager = orm_manager;
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
            });
        }else{
            
        }
    });
}

exports.findCategoriesByName = function (store_name, keyword) {

}
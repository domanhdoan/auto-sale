'use strict';
module.exports = function (Sequelize, DataTypes) {
    var Product = Sequelize.define('Product', {
        code: { 
            type: DataTypes.STRING,
        },
        title: {
            type: DataTypes.STRING,
        },
        thumbnail: {
            type: DataTypes.STRING
        },
        desc: {
            type: DataTypes.STRING(128),
        },
        price: {
            type: DataTypes.INTEGER
        },
        discount: {
            type: DataTypes.INTEGER
        },
        percentage: {
            type: DataTypes.STRING
        },
        link: {
            type: DataTypes.STRING
        },
        brand: {
            type: DataTypes.STRING
        },
        finger: {
            type: DataTypes.STRING
        }
    },
    {
        freezeTableName: true
    });

    return Product;
}
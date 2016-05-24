'use strict';
module.exports = function (Sequelize, DataTypes) {
    var Product = Sequelize.define('Product', {
        // code: { 
        //     type: DataTypes.STRING,
        // },
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
            type: DataTypes.STRING(64)
        },
        discount: {
            type: DataTypes.STRING
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
        size: {
            type: DataTypes.STRING
        }
    },
    {
        freezeTableName: true
    });

    return Product;
}
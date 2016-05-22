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
            type: DataTypes.STRING
        },
        price: {
            type: DataTypes.STRING
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
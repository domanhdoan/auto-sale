'use strict';
module.exports = function (Sequelize, DataTypes) {
    var ProductPhoto = Sequelize.define('ProductPhoto', {
        thumbnail: {
            type: DataTypes.STRING
        }
    },
    {
        freezeTableName: true
    });

    return ProductPhoto;
}
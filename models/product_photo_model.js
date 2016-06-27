'use strict';
module.exports = function(Sequelize, DataTypes) {
    var ProductPhoto = Sequelize.define('ProductPhoto', {
        link: {
            type: DataTypes.STRING
        },
        thumbFlag: {
            type: DataTypes.BOOLEAN
        }
    }, {
        freezeTableName: true
    });

    return ProductPhoto;
}
'use strict';
module.exports = function(Sequelize, DataTypes) {
    var ProductPhoto = Sequelize.define('ProductPhoto', {
        link: {
            type: DataTypes.STRING
        },
        thumbFlag: {
            type: DataTypes.INTEGER
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });

    return ProductPhoto;
}
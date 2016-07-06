'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('StoreInfo', {
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        link: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
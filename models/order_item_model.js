'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('FashionItem', {
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        charge: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
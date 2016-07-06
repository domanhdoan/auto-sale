'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('Size', {
        value: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
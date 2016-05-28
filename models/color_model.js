'use strict';
module.exports = function (Sequelize, DataTypes) {
    return Sequelize.define('Color', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        value: {
            type: DataTypes.STRING,
        }
    },
    {
        freezeTableName: true
    });
}
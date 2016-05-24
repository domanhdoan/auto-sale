'use strict';
module.exports = function (Sequelize, DataTypes) {
    return Sequelize.define('Color', {
        value: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        freezeTableName: true
    });
}
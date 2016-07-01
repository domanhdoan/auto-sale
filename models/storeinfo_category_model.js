'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('StoreInfoCategory', {
        type: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        freezeTableName: true
    });
}
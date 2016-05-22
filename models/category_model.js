'use strict';
module.exports = function(Sequelize, DataTypes)  {
    return Sequelize.define('Category', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        }
    },
    {
        freezeTableName: true
    });
}
'use strict';
module.exports = function(Sequelize, DataTypes)  {
    return Sequelize.define('Store', {
            home: {
                type: DataTypes.STRING,
                allowNull: false
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false
            },
    },
    {
        freezeTableName: true
    });
}
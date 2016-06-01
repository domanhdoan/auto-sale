'use strict';
module.exports = function(Sequelize, DataTypes)  {
    return Sequelize.define('FashionItem', {
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
    },
    {
        freezeTableName: true
    });
}
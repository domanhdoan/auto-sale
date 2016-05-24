'use strict';
module.exports = function(Sequelize, DataTypes)  {
    return Sequelize.define('Order', {
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        plan_delivery_date: {
            type: DataTypes.STRING,
            allowNull: true
        },
        actual_delivery_date: {
            type: DataTypes.STRING,
            allowNull: false
        },
        status:{
            type: DataTypes.STRING,
            allowNull: false 
        }
    },
    {
        freezeTableName: true
    });
}
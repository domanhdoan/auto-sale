'use strict';
module.exports = function(Sequelize, DataTypes)  {
    return Sequelize.define('Invoice', {
        fbid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        creation_date: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.NOW,
            allowNull: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        plan_delivery_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        actual_delivery_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        total_vat: {
            type: DataTypes.STRING,
            allowNull: false
        },
        total_payment: {
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
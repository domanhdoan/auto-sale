'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('Invoice', {
        fbid: {
            type: DataTypes.STRING,
            allowNull: false
        },
        creation_date: {
            //type: DataTypes.DATE,
            type: DataTypes.STRING,
            //defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            allowNull: false
        },
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
        email: {
            type: DataTypes.STRING,
            allowNull: true
        },
        plan_delivery_date: {
            //type: DataTypes.DATEONLY,
            type: DataTypes.STRING,
            allowNull: true
        },
        actual_delivery_date: {
            //type: DataTypes.DATEONLY,
            type: DataTypes.STRING,
            allowNull: true
        },
        total_vat: {
            type: DataTypes.STRING,
            allowNull: true
        },
        total_payment: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'

    });
}
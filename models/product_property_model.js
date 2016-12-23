'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('Property', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        svalue: {
            type: DataTypes.STRING,
        },
        ivalue: {
            type: DataTypes.INTEGER,
        }

    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
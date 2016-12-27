'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('Category', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        cover: {
            type: DataTypes.STRING,
        },
        link: {
            type: DataTypes.STRING,
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('ProductPhoto', {
        link: {
            type: DataTypes.STRING,
            allowNull: true
        },
        thumbFlag: {
            type: DataTypes.BOOLEAN,
			allowNull: true
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
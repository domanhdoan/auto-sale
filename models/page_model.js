'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('Page', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        pageId: {
            type: DataTypes.STRING,
            allowNull: false
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false
        },
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}

'use strict';
module.exports = function(Sequelize, DataTypes) {
    return Sequelize.define('Fanpage', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        page_id: {
            type: DataTypes.INTEGER,
        }
    }, {
        freezeTableName: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });
}
module.exports = function (Sequelize, DataTypes) {
    return Sequelize.define('ProductDetails', {
    },
    {
        freezeTableName: true
    });
}
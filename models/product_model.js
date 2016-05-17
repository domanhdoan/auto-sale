module.exports = function(Sequelize)  {
    var ProductInfo = Sequelize.define('product_info', {
            code: {
                type: Sequelize.STRING,
            },
            title: {
                type: Sequelize.STRING,
            },
            thumbnail: {
                type: Sequelize.STRING
            },
            desc: {
                type: Sequelize.STRING
            },
            price: {
                type: Sequelize.INTEGER
            },
            discount: {
                type: Sequelize.INTEGER
            },
            percentage: {
                type: Sequelize.STRING
            }
        }, 
        {
            freezeTableName: true, // Model tableName will be the same as the model name
        });
    ProductInfo.sync({force: true}).then(function () {
        return ProductInfo.create({
        });
    });
    return ProductInfo;
}
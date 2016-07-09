'use strict';
module.exports = function(Sequelize, DataTypes) {
    var Product = Sequelize.define('Product', {
        code: {
            type: DataTypes.STRING,
        },
        title: {
            type: DataTypes.STRING,
        },
        thumbnail: {
            type: DataTypes.STRING
        },
        desc: {
            type: DataTypes.STRING(128),
        },
        price: {
            type: DataTypes.INTEGER
        },
        discount: {
            type: DataTypes.INTEGER
        },
        percentage: {
            type: DataTypes.STRING
        },
        link: {
            type: DataTypes.STRING
        },
        brand: {
            type: DataTypes.STRING
        },
        type: {
            type: DataTypes.STRING,
            allowNull: true
        },
        finger: {
            type: DataTypes.STRING
        }
    }, {
        classMethods: {
            addFullTextIndex: function() {
                var searchFields = ['finger'];
                var Product = this;
                Sequelize
                    .query('ALTER TABLE ' + Product.name + ' ADD FULLTEXT(' + searchFields.toString().replaceAll('[', '').replaceAll(']', '') + ')')
                    .spread(function(results, metadata) {
                        if (results == null) {
                            console.log("Can not create index");
                        } else {
                            console.log("Product::addFullTextIndex" + JSON.stringify(results));
                        }
                    });
            },
        }
    }, {
        freezeTableName: true,
        syncOnAssociation: true,
        charset: 'utf8',
        collate: 'utf8_general_ci'
    });

    return Product;
}
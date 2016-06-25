'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable(
      'Product',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING,
        },
        title: {
          type: Sequelize.STRING
        },
        thumbnail: {
          type: Sequelize.STRING
        },
        desc: {
          type: Sequelize.STRING(128)
        },
        price: {
          type: Sequelize.INTEGER
        },
        discount: {
          type: Sequelize.INTEGER
        },
        percentage: {
          type: Sequelize.STRING
        },
        link: {
          type: Sequelize.STRING
        },
        brand: {
          type: Sequelize.STRING
        },
        finger: {
          type: Sequelize.STRING
        },
        StoreId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Store',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        },
        CategoryId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Category',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }
      },
      {
        engine: 'InnoDB', // default: 'InnoDB'
        charset: 'utf8' // default: null
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    queryInterface.dropTable('Product');
  }
};

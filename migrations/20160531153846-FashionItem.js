'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.createTable(
      'FashionItem',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        quantity: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        ProductId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Product',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        },
        ColorId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Color',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        },
        SizeId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Size',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        },
        InvoiceId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Invoice',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }
      },
      {
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
    return queryInterface.dropTable('FashionItem');

  }
};

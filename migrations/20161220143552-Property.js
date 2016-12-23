'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable(
      'Property',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        svalue: {
          type: Sequelize.STRING,
        },
		ivalue: {
          type: Sequelize.INTEGER,
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
        ProductId: {
          type: Sequelize.INTEGER,
          references: {
            model: 'Product',
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
    return queryInterface.dropTable('Property');
  }
};

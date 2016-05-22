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
        title: {
          type: Sequelize.STRING
        },
        thumbnail: {
          type: Sequelize.STRING
        },
        desc: {
          type: Sequelize.STRING
        },
        price: {
          type: Sequelize.STRING
        },
        discount: {
          type: Sequelize.STRING
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
        size: {
          type: Sequelize.STRING
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
  }
};

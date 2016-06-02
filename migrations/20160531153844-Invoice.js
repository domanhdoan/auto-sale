'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.createTable('Invoice', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      creation_date: {
        //type: Sequelize.DATE,
        //defaultValue: Sequelize.NOW,
        type: Sequelize.STRING,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        defaultValue: "",
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING,
        defaultValue: "",
        allowNull: true
      },
      address: {
        type: Sequelize.STRING,
        defaultValue: "",
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
         defaultValue:"",
        allowNull: true
      },
      plan_delivery_date: {
        //type: DataTypes.DATEONLY,
        type: Sequelize.STRING,
        allowNull: true
      },
      actual_delivery_date: {
        //type: DataTypes.DATEONLY,
        type: Sequelize.STRING,
        allowNull: true
      },
      total_vat: {
        type: Sequelize.STRING,
        allowNull: true
      },
      total_payment: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        allowNull: true
      }
    },
      {
        charset: 'utf8' // default: null
      });
  },

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.dropTable('Invoice');

  }
};

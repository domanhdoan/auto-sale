'use strict';

module.exports = {
    up: function(queryInterface, Sequelize) {
        /*
          Add altering commands here.
          Return a promise to correctly handle asynchronicity.

          Example:
          return queryInterface.createTable('users', { id: Sequelize.INTEGER });
        */
        queryInterface.addColumn(
            'Product',
            'type', {
                type: Sequelize.STRING,
                allowNull: true,
                defaultValue: ""
            }
        );
        queryInterface.removeColumn('Product', 'percentage');
        return queryInterface.addColumn(
            'Size',
            'quantity', {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 0
            }
        );
    },

    down: function(queryInterface, Sequelize) {
        /*
          Add reverting commands here.
          Return a promise to correctly handle asynchronicity.

          Example:
          return queryInterface.dropTable('users');
        */
        queryInterface.removeColumn('Product', 'type');
        return queryInterface.removeColumn('Size', 'quantity');
    }

};

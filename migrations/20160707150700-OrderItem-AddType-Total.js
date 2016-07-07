'use strict';

module.exports = {
    up: function(queryInterface, Sequelize) {
        /*
          Add altering commands here.
          Return a promise to correctly handle asynchronicity.

          Example:
          return queryInterface.createTable('users', { id: Sequelize.INTEGER });
        */
        //var ret = queryInterface.renameColumn('FashionItem', 'charge', 'total');
        queryInterface.addColumn(
            'FashionItem',
            'total', {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: 0
            }
        )
        return queryInterface.addColumn(
            'FashionItem',
            'type', {
                type: Sequelize.STRING,
                allowNull: true,
                defaultValue: ""
            }
        )
    },

    down: function(queryInterface, Sequelize) {
        /*
          Add reverting commands here.
          Return a promise to correctly handle asynchronicity.


          Example:
          return queryInterface.dropTable('users');
        */
        return queryInterface.removeColumn('FashionItem', 'type');
    }

};
module.exports = {
    init: function (){
        var Sequelize = require("sequelize");
        var orm_manager = new Sequelize('product_crawler', 'root', 'mysql', {
            host: '127.0.0.1',
            dialect: 'mysql',
            pool: {
                max: 5,
                min: 0,
                idle: 10000
            },
            define: {
                timestamps: false // true by default
            }
        });
    },
    
    get_sequelize: function(){
        
        
    },
    save: function (object) {
        
    },
    
    close: function(){
        
    }
}
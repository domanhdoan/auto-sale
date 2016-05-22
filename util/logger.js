var winston = require('winston');
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.File)({ 
            filename: 'auto_sale.log',
            handleExceptions: true,
            humanReadableUnhandledException: true}
        )]
  });
  
module.exports.info = function(message){
    logger.info(message);
}

module.exports.warn = function(message){
     logger.info(message);
}

module.exports.error = function(message){
     logger.info(message);
}

module.exports.debug = function(message){
     logger.log('debug', message);
}
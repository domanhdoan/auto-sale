var winston = require('winston');
var config = require("../config/config.js");
var logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)(),
        new(winston.transports.File)({
            filename: config.develop.log_path,
            handleExceptions: true,
            humanReadableUnhandledException: true
        })
    ]
});

module.exports.info = function(message) {
    if (config.develop.debug) {
        logger.info(message);
    }
}

module.exports.warn = function(message) {
    if (config.develop.debug) {
        logger.log('warn', message);
    }
}

module.exports.error = function(message) {
    if (config.develop.debug) {
        logger.log('error', message);
    }
}

module.exports.debug = function(message) {
    if (config.develop.debug) {
        logger.log('debug', message);
    }
}

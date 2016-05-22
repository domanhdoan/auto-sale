/*
 * Configuration options
 */

var config = {};

config.jobs = {};
config.jobs.dir = './storage/';

config.storage = {};
config.storage.db = {};
config.storage.engine = 'mysql';
config.storage.db.database = './storage/crawlingdata.db';


module.exports = config;

## Simple Web crawling for e-commerce web sites

* To install dependencies, run `npm install`
* Now run `node app.js` to print the help
* To support crawling new website, please create a new Web UI Pattern and put to ./pattern/
* Make migration before running
* Init config files
** .\node_modules\.bin\sequelize init
* Decide model changes
** .\node_modules\.bin\sequelize migration:create --name "migration_name"
* Migration
** .\node_modules\.bin\sequelize db:migrate


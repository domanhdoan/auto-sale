const Logger = require('node-wit').Logger;
const levels = require('node-wit').logLevels;
const Wit = require('node-wit').Wit;
const token = "KC3O6APRJCWSBOTU4GFRSIG5TKS4E4TI"; //Doan
// const token = "GI6RANKWBMIWTOMDSBGXIUYZROFBCVGK"; // Nghia
const logger = new Logger(levels.DEBUG);
var common = require("../util/common");

var find_categories_cb = null;
var find_products_cb = null;
var g_all_user_session = null;

const firstEntityValue = (entities, entity) => {
    const val = entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0 &&
        entities[entity][0].value;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};

var search_entities = [];

const actions = {
    say(sessionId, context, message, cb) {
        console.log(message);
        cb();
    },
    merge(sessionId, context, entities, message, cb) {
        cb(context);
        // var seach_entitites = (entities.local_search_query != null)? entities.local_search_query:entities.search_query; 
        // search_entities[sessionId] = seach_entitites;
        // if(seach_entitites != null){            
        //     for (var i = 0; i < seach_entitites.length; i++) {
        //         console.log(JSON.stringify(seach_entitites[i]));
        //     }
        // }else{}
        var keySet = Object.keys(entities);
        for (var key in keySet) {
            console.log(JSON.stringify(entities[keySet[key]][0]));
        }
    },
    error(sessionId, context, error) {
        console.log(error.message);
    },
    find_categories(sessionId, context, cb) {
        console.log("find_categories Session ID = " + sessionId);
        cb(context);
        find_categories_cb(sessionId);
        g_all_user_session[sessionId].last_action = common.find_categories;
    },
    find_products(sessionId, context, cb) {
        console.log("find_product Session ID = " + sessionId);
        cb(context);
        var keywords = "";
        var search_entities_c = search_entities[sessionId];
        for (var i = 0; i < search_entities_c.length; i++) {
            console.log("entities.search query = " + search_entities_c[i].value);
            keywords += search_entities_c[i].value + "+";
        }
        keywords = keywords.replaceAll(" ", "+");
        find_products_cb(sessionId, keywords);
    },
    validate_delivery_date(sessionId, context, cb) {
        console.log("validate_delivery_date Session ID = " + sessionId);
        cb(context);
    }
};
// const client = new Wit(token, actions, logger);
const client = new Wit(token, actions);
// client.interactive();
const context = {};

module.exports.extract_intent = function (sessionId, msg, all_user_session) {
    // Let's forward the message to the Wit.ai Bot Engine
    // This will run all actions until our bot has nothing left to do
    g_all_user_session = all_user_session;

    client.runActions(
        sessionId, // the user's current session
        msg, // the user's message 
        all_user_session[sessionId].context, // the user's current session state
        (error, context) => {
            if (error) {
                console.log('Oops! Got an error from Wit:', error);
            } else {
                // Our bot did everything it has to do.
                // Now it's waiting for further messages to proceed.
                console.log('Waiting for futher messages.');

                // Based on the session state, you might want to reset the session.
                // This depends heavily on the business logic of your bot.
                // Example:
                // if (context['done']) {
                //   delete sessions[sessionId];
                // }

                // Updating the user's current session state
                all_user_session[sessionId].context = context;
            }
        }
    );
}

module.exports.set_findcategories_cb = function (callback) {
    find_categories_cb = callback;
}

module.exports.set_findproducts_cb = function (callback) {
    find_products_cb = callback;
}
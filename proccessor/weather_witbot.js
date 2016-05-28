const Logger = require('node-wit').Logger;
const levels = require('node-wit').logLevels;
const Wit = require('node-wit').Wit;
const token = "KC3O6APRJCWSBOTU4GFRSIG5TKS4E4TI"; //Doan
// const token = "GI6RANKWBMIWTOMDSBGXIUYZROFBCVGK"; // Nghia
const logger = new Logger(levels.DEBUG);

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

const actions = {
    say(sessionId, context, message, cb) {
        console.log(message);
        cb();
    },
    merge(sessionId, context, entities, message, cb) {
        const loc = firstEntityValue(entities, 'location');
        if (loc) {
            context.loc = loc;
        }
        for(var i = 0; i < entities.length; i++){
           console.log("entities[" + i + "] = " + entities[i]); 
        }
        console.log("Session ID = " + sessionId);
        console.log("all entities = " + entities.length);
        console.log("context = " + context);

        cb(context);
    },
    error(sessionId, context, error) {
        console.log(error.message);
    },
    get_weather(sessionId, context, cb) {
        console.log("Session ID = " + sessionId);
        console.log("context = " + context);
        console.log("callback = " + cb);
        cb(context);
    },
    'fetch-weather': (sessionId, context, cb) => {
        // Here should go the api call, e.g.:
        // context.forecast = apiCall(context.loc)
        context.forecast = 'sunny';
        cb(context);
    },
};
const client = new Wit(token, actions, logger);
// const client = new Wit(token, actions);
client.interactive();
const context = {};

module.exports.extract_intent2 = function(sessionId, msg){
    client.message(msg, context, (error, data) => {
        if (error) {
            console.log('Oops! Got an error: ' + error);
        } else {
            console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
        }
    });
}

module.exports.extract_intent = function(sessionId, msg, all_user_session){
    // Let's forward the message to the Wit.ai Bot Engine
    // This will run all actions until our bot has nothing left to do
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
                console.log('Waiting for futher messages. Context = ' + context);

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
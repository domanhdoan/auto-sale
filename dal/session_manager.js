var common = require("../util/common");

function SessionManager() {
    // private properties
    this.user_sessions = {};
    this.getSessions = function() {
        return this.user_sessions;
    };
    this.createNewSession = function(storeid, pageid, fbid) {
        return {
            storeid: storeid,
            pageid: pageid,
            fbid: fbid,
            context: {},
            last_product: {
                id: -1,
                title: "",
                color: -1,
                size: -1,
                categoryid: -1
            },
            last_action: common.say_greetings,
            timestamp: 0,
            last_invoice: {
                id: -1,
                name: "",
                phone: "",
                address: "",
                delivery: "",
                email: "",
                status: "",
                creation_date: "",
                is_ordering: false
            },
            last_search: ""
        };
    }
}

SessionManager.prototype.getFirstMessagingEntry = function(body) {
    const val = body.object == 'page' &&
        body.entry &&
        Array.isArray(body.entry) &&
        body.entry.length > 0 &&
        body.entry[0] &&
        // body.entry[0].id === FB_PAGE_ID &&
        body.entry[0].messaging &&
        Array.isArray(body.entry[0].messaging) &&
        body.entry[0].messaging.length > 0 &&
        body.entry[0].messaging[0];
    return val || null;
};

SessionManager.prototype.findOrCreateSession = function(storeid, pageid, fbid) {
    let sessionId;
    user_sessions = this.getSessions();
    // Let's see if we already have a session for the user fbid
    Object.keys(user_sessions).forEach(k => {
        if ((user_sessions[k].storeid === storeid) && (user_sessions[k].pageid === pageid) && (user_sessions[k].fbid === fbid)) {
            // Yep, got it!
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, let's create a new one
        sessionId = new Date().toISOString();
        user_sessions[sessionId] = this.createNewSession(storeid, pageid, fbid);
    }
    return user_sessions[sessionId];
};

SessionManager.prototype.resetSession = function(sessionId) {
    var storeid = user_sessions[sessionId].storeid;
    var pageid = user_sessions[sessionId].pageid;
    var fbid = user_sessions[sessionId].fbid;
    user_sessions[sessionId] = this.createNewSession(storeid, pageid, fbid);
}

SessionManager.prototype.deteleSession = function(sessionId) {
    delete user_sessions[sessionId];
}

module.exports = SessionManager;
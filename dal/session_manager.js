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
    var val = body.object == 'page' &&
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

SessionManager.prototype.setCategoryId = function(session, categoryid) {
    this.setProductInfo(session, {
        categoryid: categoryid
    });
}

SessionManager.prototype.setProductIdNTitle = function(session, productId, title) {
    this.setProductInfo(session, {
        id: productId,
    });
}

SessionManager.prototype.setUserAction = function(session, last_action) {
    this.setSessionInfo(session, {
        last_action: last_action
    });
}

SessionManager.prototype.setProductInfo = function(session, info) {
    var keys = Object.keys(info);
    for (var i = 0; i < keys.length; i++) {
        session.last_product[keys[i]] = info[keys[i]];
    }
}

SessionManager.prototype.setOrderStatusInfo = function(session, status) {
    this.setOrderInfo(session, {
        is_ordering: status
    });
}

SessionManager.prototype.setOrderConfirmStatusInfo = function(session, status) {
    this.setOrderInfo(session, {
        status: status
    });
}

SessionManager.prototype.setOrderInfo = function(session, info) {
    var keys = Object.keys(info);
    for (var i = 0; i < keys.length; i++) {
        session.last_invoice[keys[i]] = info[keys[i]];
    }
}

SessionManager.prototype.setSessionInfo = function(session, info) {
    var keys = Object.keys(info);
    for (var i = 0; i < keys.length; i++) {
        session[keys[i]] = info[keys[i]];
    }
}

module.exports = SessionManager;
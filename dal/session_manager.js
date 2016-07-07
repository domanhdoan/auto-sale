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
            last_category: {
                id: -1,
                title: "",
            },
            last_product: {
                id: -1,
                title: "",
                color: -1,
                size: -1,
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
                isOrdering: false
            },
            last_user_msg: [],
            last_product_search: []
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
        var session = this.createNewSession(storeid, pageid, fbid);
        session.sessionId = sessionId;
        user_sessions[sessionId] = session;
    }
    return user_sessions[sessionId];
};

SessionManager.prototype.resetSession = function(session) {
    var storeid = session.storeid;
    var pageid = session.pageid;
    var fbid = session.fbid;
    this.deteleSession(session.sessionId);
    session = this.findOrCreateSession(storeid, pageid, fbid);
}

SessionManager.prototype.deteleSession = function(sessionId) {
    delete user_sessions[sessionId];
}

SessionManager.prototype.setCategoryId = function(session, categoryid) {
    this.setCategoryInfo(session, {
        id: categoryid
    });
}

SessionManager.prototype.setCategoryInfo = function(session, info) {
    var keys = Object.keys(info);
    for (var i = 0; i < keys.length; i++) {
        session.last_category[keys[i]] = info[keys[i]];
    }
}

SessionManager.prototype.getCategoryInfo = function(session) {
    return session.last_category;
}

SessionManager.prototype.getProductInfo = function(session) {
    return session.last_product;
}

SessionManager.prototype.setProductIdNTitle = function(session, productId, title) {
    this.setProductInfo(session, {
        id: productId,
        title: title
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

SessionManager.prototype.setOrdeTrigerStatusInfo = function(session, isOrdering) {
    this.setOrderInfo(session, {
        isOrdering: isOrdering
    });
}

SessionManager.prototype.isOrdeTrigerStatusInfo = function(session) {
    return session.last_invoice.isOrdering;
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

SessionManager.prototype.getOrderInfo = function(session) {
    return session.last_invoice;
}

SessionManager.prototype.getLastAction = function(session) {
    return session.last_action;
}

SessionManager.prototype.setSessionInfo = function(session, info) {
    var keys = Object.keys(info);
    for (var i = 0; i < keys.length; i++) {
        session[keys[i]] = info[keys[i]];
    }
}


SessionManager.prototype.addProductSearch = function(session, productid) {
    session.last_product_search.push(productid);
}

SessionManager.prototype.addUserMessage = function(session, message) {
    session.last_user_msg.push(message);
}

module.exports = SessionManager;
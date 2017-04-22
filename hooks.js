// Store our hooks somewhere
var messageHooks = {};
var otherHooks = {};

// How do we report crashes?
var errHandler = undefined;

// Register a standard message hook
//
// This will be the bulk of bots - listen for !commands, etc and act on them
exports.registerMessageHook = function (cmd, func) {
    if (messageHooks[cmd])
        console.log('Overwriting existing message command ' + cmd);
    messageHooks[cmd] = func;
};

// Allow other types of events to be monitored though (eg, user state changes, etc)
exports.registerOtherHook = function (hook, func) {
    if (!otherHooks[hook])
        otherHooks[hook] = [];

    otherHooks[hook][otherHooks[hook].length] = func;
};

// Helper function to create all the hooks and link them to the d.js library
// but do so in a manner to try and avoid crashing the bot
exports.createHooks = function (bot, errorHandler) {
    errHandler = errorHandler;
    for (var k in otherHooks) {
        for (var i = 0; i < otherHooks[k].length; ++i) {
            var cb = otherHooks[k][i];
            bot.on(k, function () { try { cb(...arguments); } catch (e) { errHandler(bot, e); } });
        }
    }
};

// Helper function to actually process an onMessage. 
// Error catching and command parsing done prior to this call.
exports.onMessage = function (cmd, msg, args) {
    if (messageHooks[cmd]) {
        messageHooks[cmd](msg, args);
    }
};
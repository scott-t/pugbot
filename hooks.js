
var messageHooks = {};
var otherHooks = {};

var errHandler = undefined;

exports.registerMessageHook = function (cmd, func) {
    if (messageHooks[cmd])
        console.log('Overwriting existing message command ' + cmd);
    messageHooks[cmd] = func;
};

exports.registerOtherHook = function (hook, func) {
    if (!otherHooks[hook])
        otherHooks[hook] = [];

    otherHooks[hook][otherHooks[hook].length] = func;
};

exports.createHooks = function (bot, errorHandler) {
    errHandler = errorHandler;
    for (var k in otherHooks) {
        for (var i = 0; i < otherHooks[k].length; ++i) {
            var cb = otherHooks[k][i];
            bot.on(k, function () { try { cb(arguments); } catch (e) { errHandler(bot, e); } });
        }
    }
};

exports.onMessage = function (cmd, msg, args) {
    if (messageHooks[cmd]) {
        messageHooks[cmd](msg, args);
    }
};
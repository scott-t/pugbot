
var messageHooks = {};
var otherHooks = {};

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

exports.createHooks = function (bot) {
    for (var k in otherHooks) {
        for (var i = 0; i < otherHooks[k].length; ++i)
            bot.on(k, otherHooks[k][i]);
    }
};

exports.onMessage = function (cmd, msg, args) {
    if (messageHooks[cmd])
        messageHooks[cmd](msg, args);
};
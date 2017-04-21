// Discord bot token. Kinda important
exports.token = '';

// Leave empty if you don't want to support short prefix
exports.prefix = '!';

// Allow specific trigger word
exports.prefixFull = '!pug';


exports.makeCommand = function (command) { return exports.prefix.length > 0 ? `'${exports.prefix}${command}'` : `'${exports.prefixFull} ${command}'`; };

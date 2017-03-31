const prefix = '!';
const token = '';

exports.prefix = prefix;
exports.token = token;
exports.makeCommand = function (command) { return `'${prefix}${command}'`; };
// Go go gadget PUGBot
const Discord = require('discord.js');
const bot = new Discord.Client();

const fs = require('fs');
if (!fs.existsSync('config.js')) {
    console.log('Configuration file config.js not found!\nCopy config.sample.js and customise as needed');
    process.exit(1);
}

// Modules should assume they're chdir'd to their working dir
process.chdir('./data');

// Config file
const tools = require('./config.js');

// Hook toolkit
const hooks = require('./hooks.js');

// All the other features!
const users = require('./users.js');
const raid = require('./raid.js');
const pledges = require('./pledges.js');
const maint = require('./maint.js');
const uesp = require('./uesp.js');

// Error handler
function errorHandler(bot, e) {
    if (bot.users.has(users.OwnerId)) {
        let dm = bot.users.get(users.OwnerId).dmChannel;
        if (dm)
            dm.sendMessage('Uncaught error: ' + (e.stack != undefined ? e.stack : e));
    }

    console.log('Uncaught error: ' + (e.stack != undefined ? e.stack : e));
}

// Tests crash handler
hooks.registerMessageHook('crash', function (msg) { if (users.isOwner(msg.author)) { let i = 'a'; let b = a[22]; } });

// Gracefully exit
hooks.registerMessageHook('exit', function (msg) {
    if (users.isOwner(msg.author)) {
        bot.destroy().then(process.exit(0));
    }
});

// Gracefully exit, hoping forever restarts us
hooks.registerMessageHook('restart', function (msg) {
    if (users.isOwner(msg.author)) {
        bot.destroy().then(process.exit(1));
    }
});

// For a bit of fun
hooks.registerMessageHook('setgame', function (msg, args) {
    if (users.isAdmin(msg.author) && bot.user) {
        if (args.length > 0) {
            let game = '';
            for (var i = 0; i < args.length; i++)
                game += args[i] + ' ';
            if (game.length > 0)
                bot.user.setGame(game);
        }
        else {
            bot.user.setGame("");
        }
    }
});

// Lets get started
bot.on('ready', () => {
    console.log('D.JS loaded, initialising hooks');

    hooks.createHooks(bot, errorHandler);
    console.log('Bot loaded and ready');

    errorHandler(bot, 'blah');
});

// Bulk of the bot - message parsing
// Not sure if this should be here or in hooks.js
bot.on('message', msg => {
    // Ignore bots
    if (msg.author.bot) return;

    // Split message tokens up
    let args = msg.content.split(" ");
    let cmd = args.shift().toLowerCase();

    // See if was a full-prefix
    if (tools.prefixFull.length > 0 && tools.prefixFull == cmd) {
        if (args.length > 0)
            cmd = args.shift().toLowerCase();
        else
            return;
    }

    // See if was short prefix
    if (tools.prefix.length > 0 && cmd.startsWith(tools.prefix))
        cmd = cmd.substr(tools.prefix.length);

    // Handle hooks...
    try {
        // .. safely?
        hooks.onMessage(cmd, msg, args);

        // Log user just because
        users.registerUser(msg.author);
    }
    catch (e) {
        errorHandler(bot, e);
    }

    console.log(cmd);
});

// Error handling
bot.on('error', e => {
    console.log(e);
    process.exit(1);
});

// Error handling - sometimes bot just.... vanishes, and doesn't come back
// So we treat this as abnormal restart and let forever hold us up online
bot.on('disconnect', e => {
    process.exit(1);
});

// Error handling
process.on('uncaughtException', e => {
    errorHandler(bot, e);
});

// Error handling
process.on('unhandledRejection', function (reason, p) {
    errorHandler(bot, 'Warning: unhandled Rejection received at: Promise ' + p + ' reason ' + reason);
});

// 14 min interval for maintenance status pulling
bot.setInterval(maint.doStatusChecks, 840000, bot);

// Finally log in!
bot.login(tools.token).catch(function (e) { console.log(e); process.exit(1); });



const Discord = require('discord.js');
const fs = require('fs');
const bot = new Discord.Client();


const tools = require('./tools.js');
const hooks = require('./hooks.js');
const users = require('./users.js');
const raid = require('./raid.js');
const pledges = require('./pledges.js');
const maint = require('./maint.js');
const uesp = require('./uesp.js');


// Tests crash handler
hooks.registerMessageHook('crash', function () { let i = 'a'; let b = a[22]; });

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


// 
bot.on('ready', () => {
    hooks.createHooks(bot);
    console.log('Bot loaded');
});

bot.on('message', msg => {
    if (msg.author.bot) return;

    if (!msg.content.startsWith(tools.prefix) && msg.content.length > tools.prefix.length) { users.registerUser(msg.author); return; }

    let args = msg.content.substring(tools.prefix.length).split(" ");
    let cmd = args.shift().toLowerCase();

    try {
        hooks.onMessage(cmd, msg, args);

        users.registerUser(msg.author);
    }
    catch (e) {
        if (bot.users.has(users.OwnerId)) {
            let dm = bot.users.get(users.OwnerId).dmChannel;
            if (dm)
                dm.sendMessage(e.stack);
        }
        console.log(e.toString());
    }
    console.log(cmd);
});

bot.on('error', e => {
    console.log(e);
    process.exit(1);
});

// 14 min
bot.setInterval(maint.doStatusChecks, 840000, bot);

bot.login(tools.token).catch(function (e) { console.log(e); process.exit(1); });
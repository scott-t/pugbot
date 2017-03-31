const hooks = require('./hooks.js');
const tools = require('./tools.js');
require('datejs');
const fs = require('fs');
const moment = require('moment-timezone');

const Owner = '';
const Admin = '';

var users = {};
if (fs.existsSync('./users.json'))
    users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
else if (fs.existsSync('./usersback.json'))
    users = JSON.parse(fs.readFileSync('usersback.json', 'utf8'));

function saveUsers() {
    fs.writeFileSync('users.json', JSON.stringify(users));
}

var userHistory = {};
if (fs.existsSync('./userlog.json'))
    userHistory = JSON.parse(fs.readFileSync('userlog.json', 'utf8'));

function saveUserHistory() {
    fs.writeFileSync('userlog.json', JSON.stringify(userHistory));
}

exports.getIdByName = function (name, number) {
    var match = [];

    for (var id in users) {
        if ((users[id]['name'].toLowerCase() == name.toLowerCase() ||
                (users[id]['nick'] != undefined && users[id]['nick'].toLowerCase() == name.toLowerCase()))
            && (number == undefined || users[id]['number'] == number)) {
            match.push(id);
        }
    }

    if (match.length == 1)
        return match[0];

    return undefined;
};

exports.getUserNick = function (id) {
    let u = users[id];
    if (!u) {
        if (id['name'])
            u = id;
    }

    if (!u)
        return undefined;

    let nick = u['nick'];
    if (!nick)
        nick = u['name'];

    return nick;
};

exports.getUser = function (id) {
    return users[id];
};

exports.OwnerId = Owner;

exports.registerUser = function (user) {
    if (users[user.id])
        return;

    console.log('Registered new user: ' + user.id + ' / ' + user.username + '#' + user.discriminator);
    users[user.id] = {
        'name': user.username,
        'number': user.discriminator,
        'role': '',
        'timezone': ''
    };

    saveUsers();
};

exports.isAdmin = function (user) {
    return (user.id == Owner) || (user.id == Admin);
};

exports.isOwner = function (user) {
    return (user.id == Owner);
};

hooks.registerMessageHook('who', function (msg, args) {

    if (exports.isAdmin(msg.author) && msg.author.dmChannel) {
        if (args.length == 0) {
            let dm = msg.author.dmChannel;
            let output = 'There are ' + users.length + ' known users being tracked:\n';
            for (var user in users) {
                let u = users[user];
                output += u['name'] + '#' + u['number'] + ' - ' + user + '\n';
            }
            dm.sendMessage(output);
        }
    }

});

hooks.registerMessageHook('whoami', function (msg, args) {
msg.channel.sendMessage(msg.author.id);
});

hooks.registerMessageHook('time', function (msg, args) {
    let dm = msg.author.dmChannel;
    if (!dm) {
        console.log('Unable to open DM channel');
    }

    if (args.length < 1)
        return;

    let user = undefined;
    let id = undefined;
    if (args.length >= 1) {
        id = exports.getIdByName(args[0], args[1]);
        if (id != undefined)
            user = users[id];
    }

    if (user == undefined) {
        let output = '';
        let matches = [];
        let exact = '';
        if (args[args.length - 1].length >= 3)
            moment.tz.names().forEach(function (val) { if (val.toLowerCase() == args[args.length - 1].toLowerCase()) exact = val; if(val.toLowerCase().indexOf(args[args.length - 1].toLowerCase()) >= 0) { matches.push(val); output += `${val} ` } });

        if (exact.length > 1)
            matches = [exact];

        if (matches.length == 1) {
            if (args.length == 1) {
                let tz = moment().tz(matches[0]);
                msg.channel.sendMessage("I think it's " + tz.format('h:mm a') + " in " + tz.zoneName());
            }
            else {
                let str = "";
                let destZone = users[msg.author.id];
                if (destZone != undefined)
                    destZone = destZone['timezone'];

                for (i = 0; i < args.length - 1; ++i)
                    str += args[i] + " ";
                if (destZone == undefined)
                    msg.channel.sendMessage("I don't know your timezone to convert to");

                let tm = moment.tz(Date.parse(str).toString("yyyy-MM-ddTHH:mm:ss"), matches[0]);
                if (tm.isValid())
                    msg.channel.sendMessage("I think " + tm.format("ddd h:mm a z") + " converts to " + tm.tz(destZone).format("ddd h:mm a z"));
                else
                    msg.channel.sendMessage("I don't understand that time format");
            }
        }
        else {
            msg.channel.sendMessage("I'm not sure who or where '" + args[0] + "' is.\n\n" + (output.length > 0 ? `Possible matches: ${output}\n\n` : ''));
        }

        return;
    }

    if (user['timezone'] == undefined || user['timezone'].length <= 0) {
        msg.channel.sendMessage("I don't know " + user + "'s timezone!");
    }
    else {
        msg.channel.sendMessage("I think it's " + moment().tz(user['timezone']).format('h:mm a') + " where " + exports.getUserNick(id) + " is");
    }
});

hooks.registerMessageHook('tz', function (msg, args) {
    let dm = msg.author.dmChannel;
    if (!dm) {
        console.log('Unable to open DM channel');
        return;
    }

    let user = users[msg.author.id];
    if (args.length > 1 && exports.isAdmin(msg.author)) {
        let id = exports.getIdByName(args[1], args[2]);
        if (id != undefined)
            user = users[id];
    }
    
    if (!user) {
        if (exports.isAdmin(msg.author)) {
            dm.sendMessage('Unable to find user to set: ' + args[1]);
        }
        console.log('Unknown user');
        return;
    }

    if (args.length == 0) {
        if (user['timezone'] && user['timezone'].length > 0)
            dm.sendMessage('Your timezone is set to ' + user['timezone'] + '\nYour local time should be ' + moment().tz(user['timezone']).format('h:mm a') + '\n\nIf this is not correct, set using ' + tools.makeCommand('tz zonename'));
        else
            dm.sendMessage('Your timezone is not set. Set using ' + tools.makeCommand('tz zonename') + '\nSee https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for timezone names');
    }
    else
    {
        let searchZone = args[0];
        let zone = moment.tz.zone(searchZone);

        if (zone != null) {
            user['timezone'] = zone.name;
            saveUsers();
            dm.sendMessage('Your timezone has been set to ' + zone.name);
        }
        else {
            let output = '';
            let matches = [];
            if (searchZone.length >= 3)
                moment.tz.names().forEach(function (val) { if (val.toLowerCase().indexOf(searchZone.toLowerCase()) >= 0) { matches.push(val); output += `${val} ` }});

            if (matches.length == 1) {
                user['timezone'] = matches[0];
                saveUsers();
                dm.sendMessage('Your timezone has been set to ' + matches[0]);
            }
            else {
                dm.sendMessage("Unable to match your entered timezone '" + searchZone + "'.\n\n" + (output.length > 0 ? `Possible matches: ${output}\n\n` : 'See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for timezone names'));
            }
        }
        
    }
});

hooks.registerMessageHook('setrole', function (msg, args) {
    if (exports.isAdmin(msg.author) && args.length >= 2) {
        let user = users[args[0]];
        let dm = msg.author.dmChannel;
        if (!dm)
            return;

        if (!user) {
            user = users[exports.getIdByName(args[0], args.length == 2 ? undefined : args[1])];
            if (user) {
                user['role'] = args[args.length - 1];
                dm.sendMessage('Role for ' + user['name'] + '#' + user['number'] + ' set to ' + user['role']);
                saveUsers();
            }
        }
    }
});

hooks.registerMessageHook('setnick', function (msg, args) {
    if (args.length == 1) {
        let user = users[msg.author.id];
        if (!user)
            return;

        user['nick'] = args[0];
        saveUsers();
    }
    else if (isAdmin(msg.author) && args.length > 1) {
        let user = users[exports.getIdByName(args[1], args[2])];
        if (user && args[3] != undefined) {
            user['nick'] = args[3];
            saveUsers();
        }
    }
});

hooks.registerMessageHook('lastspoke', function (msg, args) {
    if (args.length < 1)
        return;

    let user = exports.getIdByName(args[0], args[1]);
    if (!user) {
        msg.channel.sendMessage("I'm not sure who '" + args[0] + (args[1] != undefined ? '#' + args[1] : '') + "' is");
        return;
    }

    msg.client.fetchUser(user)
        .then(function (u) {
            let msgId = u.lastMessageID;
            if (msgId == null) {
                msg.channel.sendMessage("I don't remember seeing " + u.username + "#" + u.discriminator + " speak");
            }
            else {
                msg.channel.sendMessage(msgId);
            }
        })
        .catch(function (reason) { });

});

hooks.registerOtherHook('presenceUpdate', function (oldGM, newGM) {
    if (newGM.presence.status == "offline") {
        userHistory[newGM.id] = moment().unix();
    }
    else {
        delete userHistory[newGM.id];
    }
    saveUserHistory();

});

hooks.registerMessageHook('lastseen', function (msg, args) {
    if (args.length < 1)
        return;

    let user = exports.getIdByName(args[0], args[1]);
    if (!user) {
        msg.channel.sendMessage("I'm not sure who '" + args[0] + (args[1] != undefined ? '#' + args[1] : '') + "' is");
        return;
    }

    msg.client.fetchUser(user)
        .then(function (u) {
            if (u.presence.status != "online") {
                msg.channel.sendMessage(u.username + "#" + u.discriminator + " is right here!");
            }
            else {
                let lastSeen = userHistory[user];
                if (lastSeen != undefined) {
                    lastSeen = moment.unix(lastSeen);
                    msg.channel.sendMessage(u.username + "#" + u.discriminator + " was last seen going offline " + (lastSeen.fromNow()));
                }
                else
                    msg.channel.sendMessage(u.username + "#" + u.discriminator + " is offline but was not seen disconnecting");
            }
        })
        .catch(function (reason) { });
});
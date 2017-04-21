const hooks = require('./hooks.js');
const users = require('./users.js');
const fs = require('fs');
const moment = require('moment-timezone');

const baseRaidTime = 1484546400;

var raid = { 'order' : {}, 'vote' : {}};
if (fs.existsSync('./raid.json'))
    raid = JSON.parse(fs.readFileSync('raid.json', 'utf8'));
else if (fs.existsSync('./raidback.json'))
    raid = JSON.parse(fs.readFileSync('raidback.json', 'utf8'));

if (!raid['order'])
    raid['order'] = {};
if (!raid['vote'])
    raid['vote'] = {};

function saveRaid() {
    fs.writeFileSync('raid.json', JSON.stringify(raid));
}

function parseVote(vote) {
    if (vote == undefined)
        return 0;

    vote = vote.toLowerCase();
    if (vote == 'y')
        return 1;
    if (vote == 'n')
        return -1;

    return 0;
}

hooks.registerMessageHook('vote', function (msg, args) {
    let sat = parseVote(args[0]),
        sun = parseVote(args[1]);

    if (args.length < 2 || sat == 0 && sun != 0) {
        msg.channel.sendMessage("Command format should be as following:\n " + tools.makeCommand("vote ") + "[y|n][y|n]\n\nExample: /vote n y\ny = yes\nn = no");
        return;
    }

    let user = msg.author.id;
    
    if (args.length > 2 && users.isAdmin(msg.author)) {
        user = users.getIdByName(args[2], args[3]);
        if (!user)
            return;
    }

    raid['vote'][user] = [sat, sun];
    saveRaid();
});

function makeCol(item, width, leftAlign) {
    if (item == undefined)
        item = '';
    if (leftAlign == undefined || leftAlign == true) {
        return item.substring(0, width) + (item.length < width ? ' '.repeat(width - item.length) : '');
    }
    else {
        let pad = (width - item.length);
        return (item.length < width ? ' '.repeat(pad >> 1) : '') + item.substring(0, width) + (item.length < width ? ' '.repeat((pad >> 1) + (pad % 2)) : '');
    }
}

function printVote(vote) {
    if (vote == -1) {
        return '\u2717';
    }
    else if (vote == 1) {
        return '\u2713';
    }
    else {
        return '\u29FF';
    }

}

function makeRow(user, vote, compact) {
    let tm = raid['time'];
    if (!tm)
        tm = baseRaidTime;
    let output = '';
    tm = moment.unix(tm);
    if (!vote)
        vote = [];

    if (!compact) {
        output = makeCol(users.getUserNick(user), 6) + ' ' + makeCol(user['role'], 10, false) + '\t' + (user['timezone'] ? tm.tz(user['timezone']).format('hh:mm a') : '        ') + '\t    ' + printVote(vote[0]) + '\t    ' + printVote(vote[1]);
    }
    else {
        output = makeCol(users.getUserNick(user), 5) + '|' + (user['timezone'] ? tm.tz(user['timezone']).format('hh:mm a') : '        ') + '| ' + printVote(vote[0]) + '    ' + printVote(vote[1]);
    }

    return output;
}

hooks.registerMessageHook('chips', function (msg, args) {
    let order = raid['order'];
    if (!order)
        return;

    let votes = raid['vote'];
    if (!votes)
        votes = {};

    let output = 'Name      Role   Local Start Time  Fri/Sat  Sat/Sun\n---------------------------------------------------\n';
    //let output = 'Name   Start   F/Sa Sa/Su\n-----+--------+----------\n';

    let v = [0, 0];

    for (var i = 0; i < order.length; ++i) {
        let user = users.getUser(order[i]);
        let userVote = votes[order[i]];
        if (userVote)
            userVote.forEach(function (val, idx) {
                if (val > 0) v[idx] += 1;
            });
        output += makeRow(user, votes[order[i]], false) + '\n';
    }

    msg.channel.sendMessage('```\n' + output + '---------------------------------------------------\nFri/Sat:  ' + v[0] + ' \u2713\nSat/Sun:  ' + v[1] + ' \u2713 ```');
});

hooks.registerMessageHook('chips2', function (msg, args) {
    // mostly copy-paste of above
    let order = raid['order'];
    if (!order)
        return;

    let votes = raid['vote'];
    if (!votes)
        votes = {};

    let output = 'Name   Start   F/Sa Sa/Su\n-----+--------+----------\n';

    let v = [0, 0];

    for (var i = 0; i < order.length; ++i) {
        let user = users.getUser(order[i]);
        let userVote = votes[order[i]];
        if (userVote)
            userVote.forEach(function (val, idx) {
                if (val > 0) v[idx] += 1;
            });
        output += makeRow(user, votes[order[i]], true) + '\n';
    }

    msg.channel.sendMessage('```\n' + output + '-------------------------\n            \u2713 : ' + v[0] + (v[0] >= 10 ? ' ' : '') + '  ' + v[1] + '```');
});

hooks.registerMessageHook('setorder', function (msg, args) {
    // setorder <name> [<discriminator>] index

    if (!users.isAdmin(msg.author) || args.length < 2)
        return;

    let order = raid['order'];
    if (!order)
        order = [];

    let user = users.getIdByName(args[0], args.length > 2 ? args[1] : undefined);
    if (!user) {
        let dm = msg.author.dmChannel;
        if (dm)
            dm.sendMessage('Unable to find user');
        return;
    }

    var len = order.length;
    var newOrder = [];
    for (var i = 0; i < len; ++i) {
        if (i == args[args.length - 1])
            newOrder.push(user);

        if (user != order[i])
            newOrder.push(order[i]);
    }

    if (args[args.length - 1] >= len)
        newOrder.push(user);

    raid['order'] = newOrder;
    saveRaid();
});

hooks.registerMessageHook('reset', function (msg, args) {
    raid['vote'] = {};
    saveRaid();
});

hooks.registerMessageHook('settime', function (msg, args) {
    if (args.length == 0)
        return;

    let user = users.getUser(msg.author.id);
    let tz = undefined;
    if (user)
        tz = user['timezone'];

    raid['time'] = moment.tz(args[0], tz).unix();
    saveRaid();
});

function msToTime(duration) {
    output = "";
    var seconds = parseInt((duration) % 60);
    var minutes = parseInt((duration / 60) % 60);
    var hours = parseInt((duration / (60 * 60)) % 24);
    var days = parseInt((duration / (60 * 60 * 24)) % 30);

    hours_0 = (hours === 0) ? true : false;

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    if (days > 1) {
        output = days + " days, " + hours + "h " + minutes + "min";// + ":" + seconds;
    } else if (days === 1) {
        output = days + " day, " + hours + "h " + minutes + "min";// + ":" + seconds;
    } else if (days === 0) {
        if (hours_0 === true) {
            output = minutes + "min";// + seconds;
        } else {
            output = hours + "h " + minutes + "min";// + seconds;
        }
    }


    return output;
}


hooks.registerMessageHook('raid', function (msg, args) {
    let tm = raid['time'];
    let now = moment().unix();
    if (!tm || tm == 0 || tm < (now - (60*30)))
        msg.channel.sendMessage('Raid time not set');
    else if (tm < now)
        msg.channel.sendMessage('You are either late or new time not set yet');
    else {
        let user = users.getUser(msg.author.id);
        let tz = undefined;
        if (user)
            tz = user['timezone'];

        msg.channel.sendMessage('Raid starts in ' + msToTime(tm - now) + (tz == undefined ? '' : ' (' + moment.unix(tm).tz(tz).format('h:mm a z') + ')'));
    }
});
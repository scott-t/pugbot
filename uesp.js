const hooks = require('./hooks.js');
const tools = require('./tools.js');
const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const moment = require('moment-timezone');

const http = require('http');

const setUrl = ['esolog.uesp.net', '/viewlog.php?record=setSummary&raw=true&output=csv'];

function getXml(uri, callback) {
    http.get({
        host: uri[0],
        path: uri[1]
    }, function (response) {
        var body = '';
        response.on('data', function (d) {
            body += d;
        });
        response.on('end', function () {
            callback(body);
        });
    });
}

var sets = {};
if (fs.existsSync('./sets.json'))
    sets = JSON.parse(fs.readFileSync('sets.json', 'utf8'));

function saveSets() {
    fs.writeFileSync('sets.json', JSON.stringify(sets));
}

if (!sets['lastCheck'])
    sets['lastCheck'] = moment().unix();

function printSet(index, channel) {
    let set = sets['data'];
    if (set != undefined)
        set = set[index];
    if (set == undefined)
        return;

    let msg = "**" + set['setName'] + "**\n\n" + set['setBonusDesc'] + "\n\nAvailable " + set['itemSlots'];
    channel.sendMessage(msg);
}

function doSetSearch(msg, args) {
    if (args.length == 0)
        return;

    let s = sets['data'];
    if (s == undefined)
        return;

    let search = args.join(" ").toLowerCase();
    let matches = [];
    for (i = 0; i < s.length; ++i) {
        let item = s[i]['setName'].toLowerCase();
        if (item == search) {
            matches = [i];
            break;
        }
        else if (item.indexOf(search) >= 0) {
            matches.push(i);
        }
    }

    if (matches.length <= 0) {
        msg.channel.sendMessage("Unable to find any sets matching your request");
    }
    else if (matches.length == 1) {
        printSet(matches[0], msg.channel);
    }
    else if (matches.length < 5) {
        let m = '';
        for (i = 0; i < matches.length; ++i)
            m += ' ' + s[matches[i]]['setName'] + ',';
        msg.channel.sendMessage("I found " + matches.length + " matches:" + m.substr(0, m.length-1));
    }
    else {
        msg.channel.sendMessage("There were too many matches for your search term");
    }
}

hooks.registerMessageHook('sets', function (msg, args) {
    if (sets['data'] == undefined || sets['lastCheck'] < (moment().unix() - 604800)) {
        msg.channel.startTyping();

        // 1 week
        getXml(setUrl, function (data) {
            sets['data'] = parse(data, { columns: true });
            sets['lastCheck'] = moment().unix();
            saveSets();

            doSetSearch(msg, args);
            msg.channel.stopTyping();
        });
    }
    else {
        doSetSearch(msg, args);
        msg.channel.stopTyping();
    }


});



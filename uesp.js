const hooks = require('./hooks.js');
const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const moment = require('moment-timezone');
const web = require('./web.js');

// Download related stuff to grab set information
const setUrl = 'http://esolog.uesp.net/viewlog.php?record=setSummary&raw=true&output=csv';

// Cache for a period 
var sets = {};
if (fs.existsSync('./sets.json'))
    sets = JSON.parse(fs.readFileSync('sets.json', 'utf8'));

function saveSets() {
    fs.writeFileSync('sets.json', JSON.stringify(sets));
}

if (!sets['lastCheck'])
    sets['lastCheck'] = moment().unix();

// Helper function to output set data in a consistent format
function printSet(index, channel) {
    let set = sets['data'];
    if (set != undefined)
        set = set[index];
    if (set == undefined)
        return;

    let msg = '**' + set['setName'] + '**\n\n' + set['setBonusDesc'] + '\n\nAvailable ' + set['itemSlots'];
    channel.sendMessage(msg);
}

// Find a set based on (parts) of it's name
function doSetSearch(msg, args) {
    if (args.length == 0)
        return;

    let s = sets['data'];
    if (s == undefined)
        return;

    // Try and find the name based on the command arguments
    let search = args.join(" ").toLowerCase();
    let matches = [];
    for (i = 0; i < s.length; ++i) {
        let item = s[i]['setName'].toLowerCase();
        if (item == search) {
            // Use this for a direct match
            matches = [i];
            break;
        }
        else if (item.indexOf(search) >= 0) {
            // Otherwise we were a partial match so add to the list of possibilities
            matches.push(i);
        }
    }

    // Report to user
    if (matches.length <= 0) {
        msg.channel.sendMessage("Unable to find any sets matching your request");
    }
    else if (matches.length == 1) {
        printSet(matches[0], msg.channel);
    }
    else if (matches.length < 8) {
        // Multiple options - ask which they wanted
        let m = '';
        for (i = 0; i < matches.length; ++i)
            m += ' ' + s[matches[i]]['setName'] + ',';
        msg.channel.sendMessage("I found " + matches.length + " matches:" + m.substr(0, m.length-1));
    }
    else {
        msg.channel.sendMessage("There were too many matches for your search term");
    }
}

// Main set hook
hooks.registerMessageHook('sets', function (msg, args) {
    if (sets['data'] == undefined || sets['lastCheck'] < (moment().unix() - 604800)) {
        // If we don't have pre-fetched set information or it's older than a week
        // we need to re-download it.  Use 'typing' status in place of a spinning progress bar.
        msg.channel.startTyping();

        // Download csv
        web.getHttp(setUrl, function (data) {
            // and parse it to JSON
            sets['data'] = parse(data, { columns: true });
            sets['lastCheck'] = moment().unix();

            // cache it
            saveSets();

            // then do the search
            doSetSearch(msg, args);
            msg.channel.stopTyping();
        });
    }
    else {
        doSetSearch(msg, args);
        msg.channel.stopTyping();
    }


});



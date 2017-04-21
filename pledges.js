const hooks = require('./hooks.js');
const fs = require('fs');
const moment = require('moment-timezone');

// Hijacked from WPamA addon
const resetTime = '2:00am';
const resetZone = 'America/New_York';
const baseTimestamp = 1475301600;
const baseDoW = 6 //2016-02-01 is Monday (0 - Sun, 1 - Mon, 2 - Tue, 3 - Wed, 4 - Thu, 5 - Fri, 6 - Sat)
const Maj = 0;
const Glirion = 1;
const Urgalag = 2;

// Hijacked from WPamA addon
const rotation = [['Fungal Grotto II', 'Spindleclutch I', 'Darkshade Caverns II', 'Elden Hollow I', 'Wayrest Sewers II',
    'Fungal Grotto I', 'Banished Cells II', 'Darkshade Cavern I', 'Elden Hollow II', 'Wayrest Sewers I',
    'Spindleclutch II', 'Banished Cells I'],
    ['Crypt of Hearts II', 'City of Ash I', 'Tempest Island', 'Blackheart Haven', 'Arx Corinium', 'Selene\'s Web',
        'City of Ash II', 'Crypt of Hearts I', 'Volenfell', 'Blessed Crucible', 'Direfrost Keep', 'Vaults of Madness'],
    ['Cradle of Shadows', 'Imperial City Prison', 'Ruins of Mazzatun', 'White-Gold Tower']];


function getDungeon(npc, idx) {
    if (!rotation[npc])
        return;
    return rotation[npc][idx % rotation[npc].length];
}

hooks.registerMessageHook('pledges', function(msg, args) {
    let search = undefined;
    if (args.length > 0)
        search = args[0];

    let elapsed = moment().unix() - baseTimestamp;
    let diff = Math.floor(elapsed / 86400);
    remaining = 1440 - Math.floor((elapsed % 86400) / 60);

    if (search == undefined) {
        msg.channel.sendMessage('```css\n' + getDungeon(Maj, diff) + '\n' + getDungeon(Glirion, diff) + '\n' + getDungeon(Urgalag, diff) +
            (remaining < 30 ? `\n\nIn ${remaining} min: ` + getDungeon(Maj, diff + 1) + ', ' + getDungeon(Glirion, diff + 1) + ', ' + getDungeon(Urgalag, diff + 1) : '') + '```');
    }
    else {
        for (i = 0; i < 20; ++i) {
            let pledges = getDungeon(Maj, diff + i) + '\n' + getDungeon(Glirion, diff + i) + '\n' + getDungeon(Urgalag, diff + i);
            if (pledges.toLowerCase().indexOf(search.toLowerCase()) >= 0) {
                // Match
                if (diff == 0) {
                    msg.channel.sendMessage('```css\n' + search + ' is a current pledge for another ' + (remaining > 60 ? Math.floor(remaining / 60) + ' hr' : remaining + ' min') + '!\n' + pledges + '```');
                }
                else {
                    msg.channel.sendMessage('```css\nIn ' + (i-1) + ' days ' + (remaining > 60 ? Math.floor(remaining / 60) + ' hr' : remaining + ' min') + ' the pledges will be:\n' + pledges + '```');
                }
                break;
            }
        }
    }
});

hooks.registerMessageHook('nextpledges', function (msg, args) {
    let elapsed = moment().unix() - baseTimestamp;
    let diff = Math.floor(elapsed / 86400) + 1;
    remainingH = 23 - Math.floor((elapsed % 86400) / 3600);
    remainingM = 59 - Math.floor(((elapsed % 86400) / 60) % 60);

    msg.channel.sendMessage('```css\nPledges in ' + (remainingH > 0 ? `${remainingH} hr ` : '') + `${remainingM} min\n` + getDungeon(Maj, diff) + '\n' + getDungeon(Glirion, diff) + '\n' + getDungeon(Urgalag, diff) + '```');
});
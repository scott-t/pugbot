const hooks = require('./hooks.js');
const users = require('./users.js');
const fs = require('fs');
const moment = require('moment-timezone');
const xml2js = require('xml2js').parseString;

const https = require('https');

const realmStatus = ['live-services.elderscrollsonline.com','/status/realms'];
const launcherMessage = ['live-services.elderscrollsonline.com', '/announcement/message?announcer_id=2'];

function getXml(uri, callback) {
    https.get({
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

var maint = {};
if (fs.existsSync('./maint.json'))
    maint = JSON.parse(fs.readFileSync('maint.json', 'utf8'));

if (!maint['lastStatusCheck'])
    maint['lastStatusCheck'] = moment().unix();

function saveMaint() {
    fs.writeFileSync('maint.json', JSON.stringify(maint));
}

hooks.registerMessageHook('setmaint', function (msg, args) {
});

hooks.registerMessageHook('maint', function (msg, args) {
});

exports.doStatusChecks = function (bot) {
    if (maint['lastStatusCheck'] && maint['lastStatusCheck'] > (moment().unix() - (11 * 60)))
        return;

    getXml(realmStatus, function (data) {
        let dirty = false;
        data = JSON.parse(data);
        let r = data['zos_platform_response'];
        if (!r)
            return;

        r = r['response'];
        if (!r)
            return;

        r = r['The Elder Scrolls Online (NA)'];

        if (!maint['lastStatus'] || maint['lastStatus'] != r) {
            if (bot && r.length > 0) {
                let channels = maint['channels'];
                if (channels) {
                    for (var ch in channels) {
                        if (bot.channels.has(ch))
                            bot.channels.get(ch).sendMessage('NA PC server status is now ' + r);
                    }
                }
            }
               
            dirty = true;
            maint['lastStatus'] = r;
        }

        getXml(launcherMessage, function (data) {
            data = JSON.parse(data);
            let r = data['zos_platform_response'];
            if (!r)
                return;

            r = r['response'];
            if (!r)
                return;

            let message = '';

            for (let i = 0; r && i < r.length; ++i) {
                if (r[i] && r[i]['message'] && r[i]['message'].length > 0)
                    message += r[i]['message'] + '\n';
            }

            if (!maint['lastMessage'] || maint['lastMessage'] != message) {
                if (bot && message.length > 0) {
                    let channels = maint['channels'];
                    if (channels) {
                        for (var ch in channels) {
                            if (bot.channels.has(ch))
                                bot.channels.get(ch).sendMessage('Launcher Message:\n' + message);
                        }
                    }
                }

                dirty = true;
                maint['lastMessage'] = message;
            }

            maint['lastStatusCheck'] = moment().unix();
            if (dirty)
                saveMaint();
        });
    });


    
};

hooks.registerMessageHook('pulldata', function (msg, args) { exports.doStatusChecks(undefined) });

hooks.registerMessageHook('maintannounce', function (msg, args) {
    if (args.length < 1 || !users.isAdmin(msg.author))
        return;

    var setState = false;
    if (args[0].toLowerCase() == 'set')
        setState = true;

    if (!args[0].match(/^[0-9]+$/))
        args.shift();
    
    if (args.length == 0)
        return;

    var channel = args.shift();

    if (!maint.channels)
        maint.channels = {};

    if (channel == '0')
        channel = msg.channel.id;

    if (setState)
        maint['channels'][channel] = 1;
    else
        delete maint['channels'][channel];

    saveMaint();
});
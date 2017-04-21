const hooks = require('./hooks.js');
const fs = require('fs');
const unzip = require('unzipper');
const parse = require('csv-parse/lib/sync');
const moment = require('moment-timezone');

const http = require('https');

const priceUrl = ['us.tamrieltradecentre.com', '/Download/PriceTable'];

function printLevel(level) {
    return (level > 50 ? "CP" + (level - 50) : "L" + level);
}

const qualityMap = [['Normal', 'White'], ['Fine', 'Green'], ['Superior', 'Blue'], ['Epic', 'Purple'], ['Legendary', 'Gold', 'Yellow']];
const traitMap = ['Powered', 'Charged', 'Precise', 'Infused', 'Defending', 'Training', 'Sharpened', 'Decisive', 'Sturdy', 'Impenetrable', 'Reinforced', 'Well Fitted', 'Prosperous', 'Divines', 'Nirnhoned', 'Intricate', 'Ornate', 'Arcane', 'Healthy', 'Robust', 'Special'];
const typeMap = ['One-Hand', 'Two-Hand', 'Light', 'Medium', 'Heavy', 'Shield', ['Accessory', 'Jewellery', 'Jewels', 'Jewelry'], 'SoulGem', 'ArmorGlyph', 'WeaponGlyph', ['JewelGlyph'], 'Alchemy', 'Blacksmithing', 'Clothing', 'Enchanting', 'Provisioning', 'Woodworking', ['', 'Motif'], 'StyleMaterial', 'ArmorTrait', 'WeaponTrait', ['', 'Food'], ['', 'Drink'], ['', 'Potion'], ['', 'Bait'], 'Tool', ['', 'Siege'], 'Trophy', 'Container', ['', 'Fish'], 'StyleRawMaterial', ['', 'Misc'], ['', 'Poison'], 'CraftingStation', ['', 'Light'], 'Ornamental', 'Seating', 'TargetDummy', ['', 'Recipe'], 'MasterWrit'];

function getZip(uri, callback) {
    /*callback();
    return;*/

    if (fs.existsSync('ttcprice.zip'))
        fs.unlinkSync('ttcprice.zip');
    let z = fs.createWriteStream('ttcprice.zip').on('open', () => {
        
        http.get({
            host: uri[0],
            path: uri[1]
        }, function(response) {
            response.on('data', function(d) {
                z.write(d);
            });
            response.on('end', function () {
                z.close();
                callback();
            });
        });
        
        //var spawn = require('child_process').execFile('wget', ['-O', 'ttcprice.zip', 'https://us.tamrieltradecentre.com/Download/PriceTable'], (error, stdout, stderr) => { if (!error) callback(); });
    });
    
}

var ttc = undefined;
var ttcitems = undefined;
var lastUpdate = new Date(2000, 0);
if (fs.existsSync('./ttc.json') && fs.existsSync('./ttcitems.json') && fs.existsSync('./ttcprice.zip')) {
    try {
        ttc = JSON.parse(fs.readFileSync('ttc.json', 'utf8'));
        ttcitems = JSON.parse(fs.readFileSync('ttcitems.json', 'utf8'));
    }
    catch (e) {
    }
    lastUpdate = fs.statSync('ttcprice.zip').mtime;
}

function printPrice(item, priceData, channel) {
    //{["Avg"]=175,["Max"]=175,["Min"]=175,["EntryCount"]=1,["AmountCount"]=1,}
    let suggested = priceData['SuggestedPrice'];

    let msg = "**" + getItemDesc(item) + "**\n\n" + (suggested != undefined ? "TTC Suggested " + Math.ceil(suggested) + " ~ " + Math.floor(suggested * 1.25) : "") + "\nAvg " + priceData['Avg'].toLocaleString() + " / Min " + priceData['Min'].toLocaleString() + " / Max " + priceData['Max'].toLocaleString() + "\n" + priceData['EntryCount'] + " listings / " + priceData['AmountCount'] + " items\n\nTTC prices updated " + moment(lastUpdate).fromNow();
    channel.sendMessage(msg);
}

function matchTier(item, map, args) {
    if (args == undefined || map == undefined || args.length == 0 || item == undefined)
        return -1;

    for (idx = 0; idx < args.length; ++idx) {
        let arg = args[idx].toLowerCase();

        for (i = 0; i < map.length; ++i) {
            if (Array.isArray(map[i])) {
                for (j = 0; j < map[i].length; ++j) {
                    let it = map[i][j];
                    if (it.length == 0)
                        break;

                    if (it.toLowerCase().indexOf(arg) == 0) {
                        args.splice(idx, 1);
                        return i;
                    }
                }
            }
            else if (map[i].toLowerCase().indexOf(arg) == 0) {
                args.splice(idx, 1);
                return i;
            }
        }

    }

    return -1;
}

function getItemDesc(item) {
    let ret = item.name;
    if (item.trait >= 0 && traitMap[item.trait] != undefined)
        ret = traitMap[item.trait].toLowerCase() + " " + ret;

    if (item.level >= 0)
        ret = printLevel(item.level) + " " + ret;

    if (item.quality >= 0 && qualityMap[item.quality] != undefined)
        ret = qualityMap[item.quality][0].toLowerCase() + " " + ret;

    return ret;
}

function errorTier(msg, item, keys, map) {
    let q = '';
    if (Array.isArray(map[0]))
        keys.forEach((v, idx) => { q += map[v][0] + ' ' });
    else
        keys.forEach((v, idx) => { q += map[v] + ' ' });

    msg.channel.sendMessage('I found ' + getItemDesc(item) + ' in multiple tiers\n\nPlease include one of the tiers in your search: ' + q);
}

function doPriceSearch(msg, args, item) {
    if (args.length == 0 || ttc == undefined || ttcitems == undefined)
        return;

    let itemId = ttcitems[item.name];
    if (itemId == undefined)
        return;

    // Now we either just take the name plain or look at manipulating it slightly to pick up traits, etc
    let quality = ttc['Data'];
    if (quality == undefined)
        return;

    quality = quality[itemId];
    if (quality == undefined)
        return;

    let keys = Object.keys(quality);
    if (keys.length == 1)
        item.quality = keys[0];
    
    let level = quality[item.quality];
    if (level == undefined) {
        errorTier(msg, item, keys, qualityMap);
        return;
    }

    keys = Object.keys(level);
    if (keys.length == 1)
        item.level = keys[0];

    let trait = level[item.level];
    if (trait == undefined) {
        let q = '';
        keys.forEach((v, idx) => { q += printLevel(v) + ' ' });
        item.level = -1;
        msg.channel.sendMessage('I found ' + getItemDesc(item) + ' in multiple levels\n\nPlease include one of the levels in your search: ' + q);
        return;
    }

    keys = Object.keys(trait);
    if (keys.length == 1)
        item.trait = keys[0];

    let price = trait[item.trait];
    if (price == undefined) {
        errorTier(msg, item, keys, traitMap);
        return;
    }

    if (price['Min'] != undefined)
        printPrice(item, price, msg.channel);
    else {
        keys = Object.keys(price);
        if (keys.length == 1)
            item.category = keys[0];

        let category = price[item.category];
        if (category == undefined) {
            errorTier(msg, item, keys, typeMap);
            return;
        }

        if (category['Min'] != undefined)
            printPrice(item, category, msg.channel);
        else
            console.log("More TTC processing needed for item " + item.name);
    }
}

function parseString(args) {
    let item = { name: '', quality: -1, level: -1, trait: -1, effect: [], category: -1 };
    item.quality = matchTier(item, qualityMap, args);
    item.trait = matchTier(item, traitMap, args);
    item.category = matchTier(item, typeMap, args);

    for (i = 0; i < args.length; ++i) {
        let m = /^(l|cp?)?(\d+)$/gi.exec(args[i]);
        if (m != null) {
            if (m[2] > 50 || m[1] == undefined) {
                item.level = parseInt(m[2]) + 50;
            }
            else {
                if (m[1].toLowerCase() == 'l')
                    item.level = parseInt(m[2]);
                else
                    item.level = parseInt(m[2]) + 50;
            }

            args.splice(i, 1);
            break;
        }

    }

    return item;
}

function doItemSearch(msg, args) {
    if (args.length == 0 || ttc == undefined || ttcitems == undefined)
        return;

    let item = parseString(args);

    let search = args.join(" ").toLowerCase();
    let matches = [];
    let keys = Object.keys(ttcitems);
    for (let i = 0; i < keys.length; ++i) {
        let key = keys[i];
        let item = key.toLowerCase();
        if (item == search) {
            matches = [key];
            break;
        }
        else if (key.toLowerCase().indexOf(search) >= 0) {
            matches.push(key);
        }
    }


    if (matches.length <= 0) {
        msg.channel.sendMessage("Unable to find an item matching '" + search + "'");
    }
    else if (matches.length == 1) {
        item.name = matches[0];
        doPriceSearch(msg, args, item);
    }
    else if (matches.length < 8) {
        let m = '';
        for (i = 0; i < matches.length; ++i)
            m += ' ' + matches[i] + ',';
        msg.channel.sendMessage("I found " + matches.length + " matches:" + m.substr(0, m.length-1));
    }
    else {
        msg.channel.sendMessage("There were too many matches for your search term");
    }
}

function replaceFileSync(file) {
    //Read contents
    var contents = fs.readFileSync(file, 'utf8');

    contents = contents.replace(/\["/g, '"').replace(/"\]/g, '"').replace(/\[/g, '"').replace(/\]/g, '"').replace(/,}/g, '}').replace(/=/g, ':');

    contents = contents.substring(contents.indexOf('{'), contents.lastIndexOf('}')+1);

    //Write to file
    fs.writeFileSync(file, contents, 'utf8');
    return true;
}

hooks.registerMessageHook('ttc', function (msg, args) {
    if (ttc == undefined || ttcitems == undefined || ttcitems.length < 100 || ttc['Data'] == undefined || (new Date() - lastUpdate) > 172800000) {
        msg.channel.startTyping();

        
        // 1 week
        getZip(priceUrl, function() {
            // Unzip
            fs.createReadStream('ttcprice.zip').pipe(unzip.Extract({ path: './' }).on('finish', () => {
                // Parse/process into JSON
                replaceFileSync('PriceTable.lua');
                replaceFileSync('ItemLookUpTable_EN.lua');
                    
                fs.renameSync('PriceTable.lua', 'ttc.json');
                fs.renameSync('ItemLookUpTable_EN.lua', 'ttcitems.json');

                ttc = JSON.parse(fs.readFileSync('ttc.json', 'utf8'));
                ttcitems = JSON.parse(fs.readFileSync('ttcitems.json', 'utf8'));
                lastUpdate = fs.statSync('ttc.json').mtime;

                doItemSearch(msg, args);
                msg.channel.stopTyping();              
            }));
               
        });
    }
    else {
        doItemSearch(msg, args);
        msg.channel.stopTyping();
    }


});



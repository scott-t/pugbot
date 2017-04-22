const hooks = require('./hooks.js');
const fs = require('fs');
const unzip = require('unzipper');
const parse = require('csv-parse/lib/sync');
const moment = require('moment-timezone');

const web = require('./web.js');

const priceUrl = 'https://us.tamrieltradecentre.com/Download/PriceTable';

const qualityMap = [['Normal', 'White'], ['Fine', 'Green'], ['Superior', 'Blue'], ['Epic', 'Purple'], ['Legendary', 'Gold', 'Yellow']];
const traitMap = ['Powered', 'Charged', 'Precise', 'Infused', 'Defending', 'Training', 'Sharpened', 'Decisive', 'Sturdy', 'Impenetrable', 'Reinforced', 'Well Fitted', 'Prosperous', 'Divines', 'Nirnhoned', 'Intricate', 'Ornate', 'Arcane', 'Healthy', 'Robust', 'Special'];
const typeMap = ['One-Hand', 'Two-Hand', 'Light', 'Medium', 'Heavy', 'Shield', ['Accessory', 'Jewellery', 'Jewels', 'Jewelry'], 'SoulGem', 'ArmorGlyph', 'WeaponGlyph', ['JewelGlyph'], 'Alchemy', 'Blacksmithing', 'Clothing', 'Enchanting', 'Provisioning', 'Woodworking', ['', 'Motif'], 'StyleMaterial', 'ArmorTrait', 'WeaponTrait', ['', 'Food'], ['', 'Drink'], ['', 'Potion'], ['', 'Bait'], 'Tool', ['', 'Siege'], 'Trophy', 'Container', ['', 'Fish'], 'StyleRawMaterial', ['', 'Misc'], ['', 'Poison'], 'CraftingStation', ['', 'Light'], 'Ornamental', 'Seating', 'TargetDummy', ['', 'Recipe'], 'MasterWrit'];

//
function printLevel(level) {
    return (level > 50 ? 'CP' + (level - 50) : 'L' + level);
}

// Load data
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

// Create message
function printPrice(item, priceData, channel) {
    //{["Avg"]=175,["Max"]=175,["Min"]=175,["EntryCount"]=1,["AmountCount"]=1,["SuggestedPrice"]=?,}
    let suggested = priceData['SuggestedPrice'];

    let msg = '**' + getItemDesc(item) + '**\n\n' + (suggested != undefined ? 'TTC Suggested ' + Math.ceil(suggested) + ' ~ ' + Math.floor(suggested * 1.25) : '') + '\nAvg ' + priceData['Avg'].toLocaleString() + ' / Min ' + priceData['Min'].toLocaleString() + ' / Max ' + priceData['Max'].toLocaleString() + '\n' + priceData['EntryCount'] + ' listings / ' + priceData['AmountCount'] + ' items\n\nTTC prices updated ' + moment(lastUpdate).fromNow();
    channel.sendMessage(msg);
}

// Helper to try and identify a tier/level/quality/etc from the search string (with an undefined order)
function matchTier(item, map, args) {
    if (args == undefined || map == undefined || args.length == 0 || item == undefined)
        return -1;

    // Search through each word in the arg list
    for (let idx = 0; idx < args.length; ++idx) {
        let arg = args[idx].toLowerCase();

        // Search through each item in the tier list
        for (let i = 0; i < map.length; ++i) {
            // ... which could have multiple names for that tier (eg, gold/legendary)
            if (Array.isArray(map[i])) {
                for (let j = 0; j < map[i].length; ++j) {
                    let it = map[i][j];
                    if (it.length == 0)
                        break;

                    // if an item matches, return that tier index and remove the arg from the search list
                    if (it.toLowerCase().indexOf(arg) == 0) {
                        args.splice(idx, 1);
                        return i;
                    }
                }
            }
            // not a multi-named tier item, just see if we match
            else if (map[i].toLowerCase().indexOf(arg) == 0) {
                args.splice(idx, 1);
                return i;
            }
        }

    }

    return -1;
}

// Generate the item textual description (name, level, etc)
function getItemDesc(item) {
    let ret = item.name;
    if (item.trait >= 0 && traitMap[item.trait] != undefined)
        ret = traitMap[item.trait].toLowerCase() + ' ' + ret;

    if (item.level >= 0)
        ret = printLevel(item.level) + ' ' + ret;

    if (item.quality >= 0 && qualityMap[item.quality] != undefined)
        ret = qualityMap[item.quality][0].toLowerCase() + ' ' + ret;

    return ret;
}

// Helper to generate an error messge if multiple tiers for a type exist but we weren't told which
function errorTier(msg, item, keys, map) {
    let q = '';
    if (Array.isArray(map[0]))
        keys.forEach((v, idx) => { q += map[v][0] + ' ' });
    else
        keys.forEach((v, idx) => { q += map[v] + ' ' });

    msg.channel.sendMessage('I found ' + getItemDesc(item) + ' in multiple tiers\n\nPlease include one of the tiers in your search: ' + q);
}

// Helper to kick off price searches once we know what we're looking for
function doPriceSearch(msg, args, item) {
    if (args.length == 0 || ttc == undefined || ttcitems == undefined)
        return;

    // Get the item ID from the item list
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

    // Special handling for levels and error reporting
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

    // Some items (eg motifs) are done here
    if (price['Min'] != undefined) {
        printPrice(item, price, msg.channel);
    }
    else {
        // but the others we may need a specifier on the type of item
        keys = Object.keys(price);
        if (keys.length == 1)
            item.category = keys[0];

        let category = price[item.category];
        if (category == undefined) {
            errorTier(msg, item, keys, typeMap);
            return;
        }

        // Should now be able to print but check just in case
        if (category['Min'] != undefined)
            printPrice(item, category, msg.channel);
        else
            console.log('More TTC processing needed for item ' + item.name);
    }
}

// Helper to try and work out what item we are looking for
function parseString(args) {
    let item = { name: '', quality: -1, level: -1, trait: -1, effect: [], category: -1 };
    item.quality = matchTier(item, qualityMap, args);
    item.trait = matchTier(item, traitMap, args);
    item.category = matchTier(item, typeMap, args);

    // level lookup is a little 'special'
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

// Helper to actually action the ttc command
function doItemSearch(msg, args) {
    if (args.length == 0 || ttc == undefined || ttcitems == undefined)
        return;

    // Parse string. Strips all the 'descriptive' words (eg, sharp/epic/etc)
    // to hopefully leave something that can be used to do the item search
    let item = parseString(args);

    // Try and find a matching item ID (eg, in-game ID for 'sword of willpower')
    // TODO: expand this to make it independant of order (eg 'willpower sword',
    // and possible ' characters as well
    let search = args.join(' ').toLowerCase();
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

    // If we don't find anything, complain
    if (matches.length <= 0) {
        msg.channel.sendMessage('Unable to find an item matching \'' + search + '\'');
    }
    // If 1 item, find a price for hopefully the specified tiers
    else if (matches.length == 1) {
        item.name = matches[0];
        doPriceSearch(msg, args, item);
    }
    // Otherwise report too many items matched
    else if (matches.length < 8) {
        let m = '';
        for (i = 0; i < matches.length; ++i)
            m += ' ' + matches[i] + ',';
        msg.channel.sendMessage('I found ' + matches.length + ' matches:' + m.substr(0, m.length-1));
    }
    else {
        msg.channel.sendMessage('There were too many matches for your search term');
    }
}

// Helper to convert the TTC data files from .lua to .json format
function replaceFileSync(file) {
    //Read contents
    var contents = fs.readFileSync(file, 'utf8');

    contents = contents.replace(/\["/g, '"').replace(/"\]/g, '"').replace(/\[/g, '"').replace(/\]/g, '"').replace(/,}/g, '}').replace(/=/g, ':');
    contents = contents.substring(contents.indexOf('{'), contents.lastIndexOf('}') + 1);

    //Write to file
    fs.writeFileSync(file, contents, 'utf8');
    return true;
}

// TTC price check hook
hooks.registerMessageHook('ttc', function (msg, args) {
    if (ttc == undefined || ttcitems == undefined || ttcitems.length < 100 || ttc['Data'] == undefined || (new Date() - lastUpdate) > 172800000) {
        msg.channel.startTyping();
        
        // 1 week
        web.getHttpFile(priceUrl, 'ttcprice.zip', function () {
            // Unzip
            fs.createReadStream('ttcprice.zip').pipe(unzip.Extract({ path: './' })).promise().then(() => {
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
            });
               
        });
    }
    else {
        doItemSearch(msg, args);
        msg.channel.stopTyping();
    }


});



var http = require('http');
var https = require('https');

// Retrieve a file over http or https and store it somewhere
exports.getHttpFile = function (uri, dest, callback) {
    let proto = null;
    if (uri.indexOf('https') === 0)
        proto = https;
    else
        proto = http;

    if (dest != null) {
        let fs = require('fs');
        let file = fs.createWriteStream(dest);
        proto.get(uri, response => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(callback);
            });

        }).on('error', err => {
            fs.unlink(dest);
        });
    }
    else {
        proto.get(uri, response => {
            let body = '';
            response.on('data', d => {
                body += d;
            });
            response.on('end', () => {
                callback(body);
            });
        });
    }
}

// Retrieve a file over http or https
exports.getHttp = function (uri, callback) {
    exports.getHttpFile(uri, null, callback);
}

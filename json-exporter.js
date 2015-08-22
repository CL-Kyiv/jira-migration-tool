var fs = require('fs');
var _path = require('path');
var config = require('config');
var _ = require('lodash');

var exportDir = config.get('exportFolder');
module.exports = (function () {
    var projRoot = _path.join(__dirname);
    var makeDir = function (path) {
        if (!path) return;
        path = path.split('\\');
        while (path.length) {
            var currPath = currPath ? _path.join(currPath, path.shift()) : path.shift();
            if (!fs.existsSync(_path.join(projRoot, currPath))) {
                fs.mkdirSync(_path.join(projRoot, currPath));
            }
        }
    };
    var makeFile = function (path, data) {
        data = JSON.stringify(data, null, 4);
        fs.writeFileSync(path, data, {flag: 'w+'});
    };
    var write = function (path, data, callback) {
        try {

            var dirPath = path.split('\\');
            dirPath.pop();
            dirPath = dirPath.join('\\');
            makeDir(_path.join(exportDir, dirPath));
            makeFile(_path.join(exportDir, path), data);
            if (callback) {
                callback(null, path, data);
            }
        }
        catch (e) {
            callback(e);
        }
    };
    return {
        write: write
    }
})();
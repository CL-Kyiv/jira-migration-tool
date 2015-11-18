var _ = require('lodash');
var fs = require('fs');
fs.readFile('export/pat/output.json', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    var users = [];

    _.each(users,function(user){
        var oldUser = new RegExp('"'+user+'"',"g");
        data = data.replace(oldUser, '""');
    });

    fs.writeFile('export/pat/output-fixed.json', data, 'utf8', function (err) {
        if (err)
            return console.log(err);
    });
});
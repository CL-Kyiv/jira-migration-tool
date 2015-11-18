/*
1. Go through all attachments
2. Find out issue key
2. Unpack each attachment
3. Attach all items to the issue
 */
/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/lodash/lodash.d.ts" />
var fs = require('fs');
var _ = require('lodash');
var zlib = require('zlib');
var path = require('path');
var unzip = require('unzip');
var config = require('./jmt.json');

var uploadAttachments = function(filesPath:string,callback:(file:string)=>any){
    fs.readdir(filesPath,function(err, list){
        if(err){
            console.log(err);
            return;
        }
        _.each(_.filter<string>([list[1]],(file:string)=>/[a-zA-Z]+-[0-9]+/.test(file)),function(file){
            callback(path.join(filesPath, file))
        });
    });
};

var attachmentsPath = 'export/'+config.projects+'/attachments';
uploadAttachments(attachmentsPath,function(file){
    //unpack
    console.log(file);
    fs.createReadStream(file)
        .pipe(unzip.Parse())
        .on('entry', function (entry) {
            var fileName = entry.path;
            var type = entry.type; // 'Directory' or 'File'
            var size = entry.size;
            console.log(fileName);
            //entry.pipe(fs.createWriteStream('output/path'));
            entry.autodrain();
        });
});
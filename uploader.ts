/// <reference path="typings/tsd.d.ts" />
var unzip = require('unzip');
var config = require('./jmt.json');
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

var uploadAttachments = function(filesPath:string,callback:(file:string)=>any){
    fs.readdir(filesPath,function(err, list){
        if(err){
            console.log(err);
            return;
        }
        _.each(_.filter<string>([list[1]],(file:string)=>/[a-zA-Z]+-[0-9]+/.test(file)),function(file){
            callback(file)
        });
    });
};
var makeDir = function(dirPath:string){
    if(!fs.existsSync(dirPath)){
        var dirInfo = path.parse(dirPath);

        if(!fs.existsSync(dirInfo.dir))
            makeDir(dirInfo.dir);
        fs.mkdirSync(dirPath);
    }
};
var exportPath = path.join('export', config.projects);
var attachmentsPath = path.join(exportPath,'attachments');
var extractPath = path.join(exportPath, 'extract');

uploadAttachments(attachmentsPath,function(file){
    //unpack
    console.log(file);
    var fileName = path.parse(file).name;
    var extractTo = path.join(extractPath, fileName);
    var fullPath = path.join(attachmentsPath, file);
    makeDir(extractTo);
    var extractedFiles:string[]=[];
    fs.createReadStream(fullPath)
        .pipe(unzip.Parse())
        .on('entry', function (entry:any) {
            var fileName = entry.path;
            var type = entry.type; // 'Directory' or 'File'
            var size = entry.size;
            console.log(fileName);
            var extractedFile = path.join(extractTo, fileName);
            entry.pipe(fs.createWriteStream(extractedFile));
            extractedFiles.push(extractedFile);
            entry.autodrain();
        });
        _.each(extractedFiles,function(attachmentFile){
            extractedFiles.push(attachmentFile);
    })
});
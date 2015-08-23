var wrapPromise = require('./../utils/promise-wrapper');
var request = require('request');
var fs = require('fs');
var Q = require('q');
var config = require('config');
var exportFolder = config.get('exportFolder');
var path = require('path');
var AttachmentsClient = module.exports = function (jira) {
    this.uploadAttachments = function (issue) {
        if (!fs.existsSync(path.join(__dirname, '..', exportFolder, 'attachments'))) {
            fs.mkdirSync(path.join(__dirname, '..', exportFolder, 'attachments'));
        }
        var deferred = Q.defer();
        request({
            auth: jira.basic_auth,
            method: 'GET',
            uri: 'https://' + jira.host + '/secure/attachmentzip/' + issue.id + '.zip'
        }, function (err, response, body) {
            if (err) {
                deferred.reject(err);s
            }
            deferred.resolve(response.headers['content-length']);
        }).pipe(fs.createWriteStream(path.join(__dirname, '..', exportFolder, 'attachments', issue.key + '.zip')));
        return deferred.promise;
    }
};
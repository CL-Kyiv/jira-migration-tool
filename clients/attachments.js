var wrapPromise = require('./../utils/promise-wrapper');
var request = require('request');
var fs = require('fs');
var Q = require('q');
var _ = require('lodash');
var config = require('config');
var exportFolder = config.get('exportFolder');
var path = require('path');
var AttachmentsClient = module.exports = function (jira) {
    this.uploadAttachments = function (issues) {
        if (!fs.existsSync(path.join(__dirname, '..', exportFolder, 'attachments'))) {
            fs.mkdirSync(path.join(__dirname, '..', exportFolder, 'attachments'));
        }
        issues = _.map(issues, function (issue) {
            return {
                id: issue.id,
                key: issue.key
            }
        });
        return Q.all(_.map(issues, function (issue, index) {
            var deferred = Q.defer();
            var file = path.join(__dirname, '..', exportFolder, 'attachments', issue.key + '.zip');
            var requestHandler = function (err, response, body) {
                if (err) {
                    deferred.reject(err);
                }
                console.log(response.connection.listeners('error').length);
                (function (fileName, index, total) {
                    winston.info(util.format('%s has been downloaded(%d/%d)', fileName, index, total));
                })(file, index, issues.length);
                deferred.resolve(file);
            };
            var rr = request({
                auth: jira.basic_auth,
                method: 'GET',
                uri: 'https://' + jira.host + '/secure/attachmentzip/' + issue.id + '.zip'
            }, requestHandler).pipe(fs.createWriteStream(file));
            return deferred.promise;
        }));
    }
};
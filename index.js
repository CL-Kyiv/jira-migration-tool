var util = require('util');
var JiraClient = require('jira-connector');
var winston = require('winston');
var prompt = require('prompt');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var Q = require('q');
var request = require('request');
var Queue = require('./clients/generic-job-queue');
var progress = require('request-progress');


var configExist = fs.existsSync('jmt.json');
if (!configExist) {
    winston.info('Can not find configuration file, jmt.json created');
    fs.writeFileSync('jmt.json', JSON.stringify(require('./default-config.json'), null, 4));
}
var config = require('./jmt.json');

var ProjectClientWrapper = new require('./clients/project');
var IssueClientWrapper = new require('./clients/issue');
var jsonExporter = require('./utils/json-exporter');
var importProject = require('./utils/json-importer');


var requestErrorHandler = function (err) {
    winston.error('Error during request', util.inspect(err));
};
var requiredProperties = ['host', 'username', 'password', 'projects'];

var prompts = {
    properties: {
        host: {
            message: 'Host',
            required: true
        },
        username: {
            message: 'User name to login',
            required: true
        },
        password: {
            message: 'Password, input will be hidden',
            required: true,
            hidden: true
        },
        projects: {
            message: 'Projects to download(comma separated list)',
            required: true
        }
    }
};

requiredProperties.forEach(function (prop) {
    if (config[prop]) {
        delete prompts.properties[prop];
        winston.info(util.format('%s = "%s" property specified in jmt.json file.', prop, config[prop]));
    }
});
prompt.colors = true;

prompt.start();

prompt.get(prompts, function (err, options) {
    var exportFolder = config.output;
    var outputPageSize = config.output_page_size;

    var username = options.username || config.username;
    var host = options.host || config.host;
    var password = options.password || config.password;
    var projectsToLoad = options.projects || config.projects;
    projectsToLoad = projectsToLoad.split(',');
    var jira = new JiraClient({
        host: host,
        basic_auth: {
            username: username,
            password: password
        }
    });
    var projectClient = new ProjectClientWrapper(jira);
    var issueClient = new IssueClientWrapper(jira);
    var exportDir = path.join(__dirname, exportFolder);
    if(!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir);
    }
    var projects = projectClient.getProjects().then(function (projects) {
        return _.filter(projects, function (project) {
            return _.contains(projectsToLoad, project.name);
        })
    });

    projects.fail(requestErrorHandler);
    projects.then(function (projects) {
        winston.info('Loaded projects:', _.pluck(projects, 'name').join('\n\t'));
        _.each(projects, projectExportFunc);
    });

    var projectExportFunc = function (project) {
        var projectDir = path.join(__dirname, exportFolder, project.name);
        if(!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir)
        }
        winston.info(util.format('%s project download starting...', project.name));
        var issueLoadingProgressCallback = function (progress, complete, total) {
            winston.info(util.format('Complete: (%d/%d) %d%%', complete, total, Math.ceil(progress * 100)));
        };
        var projIssues = issueClient.getIssues(project, issueLoadingProgressCallback);
        projIssues.fail(requestErrorHandler);
        projIssues.then(function (projIssues) {
            projIssues = projIssues.slice(0, 400);
            var issuesDir = path.join(projectDir, 'issues');
            if(!fs.existsSync(issuesDir)) {
                fs.mkdirSync(issuesDir);
            }
            var issues = projIssues.slice(0);

            winston.info(util.format('%s project download complete successful...', project.name));

            winston.info(util.format('%s project json exporting to %s folder starting...', project.name, exportFolder));
            var index = 0;
            var total = projIssues.length;
            while (projIssues.length) {
                (function (index) {
                    var part = projIssues.splice(0, outputPageSize);
                    var file = util.format(
                        '%s\\issues\\issues_%d_%d.json',
                        project.name,
                        index * outputPageSize,
                        Math.min((index + 1) * outputPageSize, total)
                    );
                    jsonExporter.exportTo(file, part);
                    winston.info(util.format('%s created', file));
                })(index);
                index++;
            }
            winston.info(util.format('%s project json exporting to %s folder complete...', project.name, exportFolder));
            var wrapPromise = require('./utils/promise-wrapper');
            var issueKeys = _.pluck(issues, 'key');
            var commentsDir = path.join(projectDir, 'comments');
            if(!fs.existsSync(commentsDir)) {
                fs.mkdirSync(commentsDir);
            }
            var getComments = function (issueKey) {
                return wrapPromise(jira.issue, 'getComments', {
                    issueKey: issueKey
                }).then(function (response) {
                    if(response.comments.length) {
                        fs.writeFileSync(path.join(commentsDir, issueKey + '.comments.json'), JSON.stringify(response.comments, null, 4), {flag: 'w+'});
                    }
                    winston.info(util.format('%s comments progress : %s/%s',issueKey, commentsQueue.progress, commentsQueue.total));
                    return response.comments;
                }, requestErrorHandler);
            };
            var commentsQueue = new Queue(issueKeys, 50, getComments);
            var comments = commentsQueue.start(20);
            var attachmentsDir = path.join(projectDir, 'attachments');
            if(!fs.existsSync(attachmentsDir)) {
                fs.mkdirSync(attachmentsDir);
            }
            var attachmentsData = _.map(issues, function (issue) {
                return {
                    key: issue.key,
                    id: issue.id,
                    url: 'https://' + host + '/secure/attachmentzip/' + issue.id + '.zip',
                    file: path.join(__dirname, exportFolder, project.name, 'attachments', issue.key + '.zip')
                };
            });
            var getAttachments = function (attachmentData) {
                var deferred = Q.defer();
                var file = attachmentData.file;
                var url = attachmentData.url;
                var fileStream = fs.createWriteStream(file);
                fileStream.on('finish', function () {
                    fileStream.close();
                    deferred.resolve(file);
                });
                var requestHandler = function (err, response, body) {
                    if (err) {
                        deferred.reject(err);
                        return;
                    }
                    if (parseInt(response.headers['content-length']) == 22) {
                        fs.unlinkSync(file);
                    }
                    winston.info(util.format('%s has been downloaded(%d/%d)', file, attachmentQueue.progress, attachmentQueue.total));
                };
                progress(
                    request({
                        jar: false,
                        auth: jira.basic_auth,
                        method: 'GET',
                        uri: url
                    }, requestHandler),
                    {
                        throttle: 3000
                    })
                    .on('progress', function (state) {
                        winston.info(util.format('%s(%d%%)', file, state.percent));
                    })
                    .on('error', function (err) {
                        console.log(err);
                    }).pipe(fileStream);
                return deferred.promise;
            };
            var attachmentQueue = new Queue(attachmentsData, 50, getAttachments);
            var attachments = attachmentQueue.start(20);
            Q.all([ comments]).then(function() {
                importProject(project).then(function () {
                    winston.info('Job complete');
                }, function(err) {
                    winston.error('Error during making output file', util.inspect(err));
                });

            }, function(err) {
                winston.error('Error : ', util.inspect(err));
            });
        });
    }
});

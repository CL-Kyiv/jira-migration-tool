var util = require('util');
var JiraClient = require('jira-connector');
var winston = require('winston');
var prompt = require('prompt');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var configExist = fs.existsSync('jmt.json');
if (!configExist) {
    winston.info('Can not find configuration file, jmt.json created');
    fs.writeFileSync('jmt.json', JSON.stringify(require('./default-config.json'), null, 4));
}
var config = require('./jmt.json');

var ProjectClientWrapper = new require('./clients/project');
var IssueClientWrapper = new require('./clients/issue');
var CommentClient = new require('./clients/comment');
var AttachmentsClient = new require('./clients/attachments');
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
    var commentClient = new CommentClient(jira);


    var attachmentsClient = new AttachmentsClient(jira);
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
        winston.info(util.format('%s project download starting...', project.name));
        var issueLoadingProgressCallback = function (progress, complete, total) {
            winston.info(util.format('Complete: (%d/%d) %d%%', complete, total, Math.ceil(progress * 100)));
        };
        var projIssues = issueClient.getIssues(project, issueLoadingProgressCallback);
        projIssues.fail(requestErrorHandler);
        projIssues.then(function (projIssues) {

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

            var comments = commentClient.uploadComments(issues);
            comments.fail(requestErrorHandler);
            var attachments = attachmentsClient.uploadAttachments(issues);
            attachments.fail(requestErrorHandler);
            Q.all([attachments, comments]).then(function () {
                return importProject(project);
            }).then(function () {
                winston.info('Export job done.')
                var attachmentUploader = new require('./clients/issue-attachment-uploader')();
                attachmentUploader.uploadAttachments(path.join(__dirname, exportFolder, project.name, 'attachments'));
            });
        });
    }
});

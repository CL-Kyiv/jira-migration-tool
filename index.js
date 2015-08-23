var JiraClient = require('jira-connector');
var winston = require('winston');
var prompt = require('prompt');
var config = require('config');
var _ = require('lodash');
var Q = require('q');
var fs = require('fs');

var ProjectClient = new require('./clients/project');
var ComponentClient = new require('./clients/component');
var IssueClient = new require('./clients/issue');
var CommentClient = new require('./clients/comment');
var AttachmentsClient = new require('./clients/attachments');
var jsonExporter = require('./utils/json-exporter');
var JsonImporter = require('./utils/json-importer');

var host = config.get('host');
var username = config.get('username');
var exportFolder = config.get('exportFolder');
var importFolder = config.get('importFolder');

winston.handleExceptions(new winston.transports.File({filename: 'error-log.txt'}));
winston.add(winston.transports.File, {filename: 'log.txt', timestamp: true});

var prompts = {
    properties: {
        host: {
            default: host,
            message: 'Host',
            required: true
        },
        username: {
            default: username,
            message: 'User name to login',
            required: true
        },
        password: {
            message: 'Password, input will be hidden',
            required: true,
            hidden: true
        }
    }
};

prompt.start();

prompt.get(prompts, function (err, options) {

    var jira = new JiraClient({
        host: options.host,
        basic_auth: {
            username: options.username,
            password: options.password
        }
    });

    winston.info('Authentication successful');

    var projectClient = new ProjectClient(jira);
    var issueClient = new IssueClient(jira);
    var componentClient = new ComponentClient(jira);
    var commentClient = new CommentClient(jira);
    var attachmentsClient = new AttachmentsClient(jira);

    var requestQueue = [];

    var projects = projectClient.getProjects();

    projects.then(function (projects) {
        winston.info('Loaded projects:', '\n', _.pluck(projects, 'name').join('\n\t'));
        _.each(projects, function (project) {
            var issuesAttachmentsDeferred = Q.defer();
            requestQueue.push(issuesAttachmentsDeferred.promise);
            var projIssues = issueClient.getIssues(project).then(function (projIssues) {
                var attachmentsRequestQueue = [];
                winston.info('Loaded issues for ' + project.name + ' project', '\n', _.map(projIssues, function (issue) {
                    return issue.key + ' / ' + issue.fields.summary
                }).join('\n\t'));
                _.each(projIssues, function (issue) {
                    var attachments = attachmentsClient.uploadAttachments(issue);
                    attachmentsRequestQueue.push(attachments);
                    attachments.then(function (size) {
                        winston.info(issue.key + '.zip ' + size + 'B  downloaded');
                    });
                    var comments = commentClient.getComments(issue);
                    requestQueue.push(comments);
                    comments.then(function (comments) {
                        if (comments.length) {
                            jsonExporter.exportTo('comments\\' + project.name + '\\' + issue.key + '\\comments.json', comments);
                        }
                    })
                });
                Q.all(attachmentsRequestQueue).then(function () {
                    issuesAttachmentsDeferred.resolve();
                });
                jsonExporter.exportTo('issues\\' + project.name + '.json', projIssues);
            });
            var projectComponents = componentClient.getComponents(project).then(function (projectComponents) {
                jsonExporter.exportTo('components\\' + project.name + '.json', projectComponents);
            });
            requestQueue.push(projIssues);
            requestQueue.push(projectComponents);
        });
        jsonExporter.exportTo('projects.json', projects);
        Q.all(requestQueue).then(function () {
            var jsonImporter = new JsonImporter(exportFolder);
            jsonImporter.importProjects();
            jsonImporter.upload();
            winston.info(
                'Job done.', '\n',
                'Exported files location: ' + __dirname + '\\' + exportFolder, '\n',
                'Output file : ' + __dirname + '\\' + importFolder + '\\' + 'import.json');
        });
    });
});
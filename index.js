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
var util = require('util');

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
        },
        projects: {
            message: 'Projects to download(comma separated list)',
            required: true
        }
    }
};
prompt.colors = true;

prompt.start();

prompt.get(prompts, function (err, options) {

    var projectsList = options.projects.split(',');
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

    var globalRequestQueue = [];

    var projects = projectClient.getProjects().then(function (projects) {
        return _.filter(projects, function (project) {
            return _.contains(projectsList, project.name);
        })
    });

    projects.then(function (projects) {
        winston.info('Loaded projects:', _.pluck(projects, 'name').join('\n\t'));

        _.each(projects, function (project) {
            //var projectIssuesDataRequests = Q.defer();
            //globalRequestQueue.push(projectIssuesDataRequests.promise);
            winston.info(util.format('%s project download starting...', project.name));
            issueClient.getIssues(project, function (progress, complete, total) {
                winston.info(util.format('Complete: (%d/%d) %d%%', complete, total, Math.ceil(progress * 100)));
            }).then(function (projIssues) {
                var issues = projIssues.slice(0);
                winston.info(util.format('%s project download complete successful...', project.name));

                //var issuesDataRequestQueue = [];
                //winston.info('Loaded issues for ' + project.name + ' project', '\n', _.map(projIssues, function (issue) {
                //    return issue.key + ' / ' + issue.fields.summary
                //}).join('\n\t'));


                //_.each(projIssues, function (issue) {

                //    issuesDataRequestQueue.push(attachments);
                //    attachments.then(function (size) {
                //        winston.info(issue.key + '.zip ' + size + 'B  downloaded');
                //    });
                //
                //    var comments = commentClient.getComments(issue);
                //    globalRequestQueue.push(comments);
                //    comments.then(function (comments) {
                //        if (comments.length) {
                //            jsonExporter.exportTo('comments\\' + project.name + '\\' + issue.key + '\\comments.json', comments);
                //        }
                //    })
                //
                //});

                //Q.all(issuesDataRequestQueue).then(function () {
                //    projectIssuesDataRequests.resolve();
                //});
                winston.info(util.format('%s project json exporting to %s folder starting...', project.name, exportFolder));
                var partSize = config.get('exportPageSize');
                var index = 0;
                var total = projIssues.length;
                while (projIssues.length) {
                    (function (index) {
                        var part = projIssues.splice(0, partSize);
                        var file = util.format(
                            'issues\\%s\\issues_%d_%d.json',
                            project.name,
                            index * partSize,
                            Math.min((index + 1) * partSize, total)
                        );
                        jsonExporter.exportTo(file, part);
                        winston.info(util.format('%s created', file));
                    })(index);
                    index++;
                }
                //winston.info(util.format('%s project json exporting to %s folder complete...', project.name, exportFolder));
                //attachmentsClient.uploadAttachments(issues, function (fileName, index, total) {
                //    winston.info(util.format('%s has been downloaded(%d/%d)', fileName, index, total));
                //}).then(function () {
                //    winston.info(util.format('%s project attachments download complete successful...', project.name));
                //}, function () {
                //    winston.info(util.format('Error during %s project attachments download...', project.name));
                //});
            }, function () {
                winston.error(util.format('Error during download %s project issues', project.name));
            });

            //var projectComponents = componentClient.getComponents(project).then(function (projectComponents) {
            //    jsonExporter.exportTo('components\\' + project.name + '.json', projectComponents);
            //});
            //globalRequestQueue.push(projectComponents);
        });

        //jsonExporter.exportTo('projects.json', projects);

        //Q.all(globalRequestQueue).then(function () {
        //    var jsonImporter = new JsonImporter(exportFolder);
        //    jsonImporter.importProjects();
        //    jsonImporter.upload();
        //    winston.info(
        //        'Job done.', '\n',
        //        'Exported files location: ' + __dirname + '\\' + exportFolder, '\n',
        //        'Output file : ' + __dirname + '\\' + importFolder + '\\' + 'import.json');
        //});
    }, function (err) {
        console.log('error');
    });
});
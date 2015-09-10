var util = require('util');
var JiraClient = require('jira-connector');
var winston = require('winston');
var prompt = require('prompt');
//var config = require('config');
var _ = require('lodash');
//var Q = require('q');
var fs = require('fs');
//var http = require('http');
//var path = require('path');

var d = require('domain').create()
d.on('error', function(err){
    // handle the error safely
    console.log(err)
})

var configExist = fs.existsSync('jmt.json');
if (!configExist) {
    winston.info('Can not find configuration file, jmt.json created');
    fs.writeFileSync('jmt.json', JSON.stringify(require('./default-config.json'), null, 4));
}
var config = require('./jmt.json');

var ProjectClientWrapper = new require('./clients/project');
//var ComponentClient = new require('./clients/component');
var IssueClientWrapper = new require('./clients/issue');
var CommentClientWrapper = new require('./clients/comment');
var AttachmentsClient = new require('./clients/attachments');
var jsonExporter = require('./utils/json-exporter');
//var JsonImporter = require('./utils/json-importer');


//var host = config.host;
//var username = config.get('username');
//var exportFolder = config.get('exportFolder');
//var importFolder = config.get('importFolder');

//winston.handleExceptions(new winston.transports.File({filename: 'error-log.txt'}));
//winston.add(winston.transports.File, {filename: 'log.txt', timestamp: true});
var requestErrorHandler = function (err) {
    winston.error('Error during request', util.inspect(err));
};
var requiredProperties = ['host', 'username', 'password', 'projects'];

var prompts = {
    properties: {
        host: {
            //default: host,
            message: 'Host',
            required: true
        },
        username: {
            //default: username,
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
    var commentClient = new CommentClientWrapper(jira);


    //winston.info('Authentication successful');

    //var componentClient = new ComponentClient(jira);
    var attachmentsClient = new AttachmentsClient(jira);
    //
    //var globalRequestQueue = [];
    //
    var projects = projectClient.getProjects().then(function (projects) {
        return _.filter(projects, function (project) {
            return _.contains(projectsToLoad, project.name);
        })
    });

    projects.fail(requestErrorHandler);
    projects.then(function (projects) {
        winston.info('Loaded projects:', _.pluck(projects, 'name').join('\n\t'));

        _.each(projects, projectExportFunc);

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

            //var issuesDataRequestQueue = [];
            //winston.info('Loaded issues for ' + project.name + ' project', '\n', _.map(projIssues, function (issue) {
            //    return issue.key + ' / ' + issue.fields.summary
            //}).join('\n\t'));


            _.each(projIssues.slice(0,3), function (issue) {

                //issuesDataRequestQueue.push(attachments);
                //attachments.then(function (size) {
                //    winston.info(issue.key + '.zip ' + size + 'B  downloaded');
                //});

                var comments = commentClient.getComments(issue);
                //globalRequestQueue.push(comments);
                comments.fail(requestErrorHandler);
                comments.then(function (comments) {
                    if (comments.length) {
                        jsonExporter.exportTo(util.format('%s\\comments\\%s.comments.json', project.name, issue.key), comments);
                    }
                })

            });

            //Q.all(issuesDataRequestQueue).then(function () {
            //    projectIssuesDataRequests.resolve();
            //});
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

            attachmentsClient.uploadAttachments(issues).then(function () {
                //try {
                //
                //    _.each(issues, function (issue) {
                //        var comments = commentClient.getComments(issue);
                //        comments.then(function (comments) {
                //            if (comments.length) {
                //                jsonExporter.exportTo(path.join('comments', project.name, issue.key + ' .json'), comments);
                //            }
                //        })
                //    })
                //}
                //catch (e) {
                //    debugger
                //}
            });

        });

        //var projectComponents = componentClient.getComponents(project).then(function (projectComponents) {
        //    jsonExporter.exportTo('components\\' + project.name + '.json', projectComponents);
        //});
        //globalRequestQueue.push(projectComponents);
    }
});

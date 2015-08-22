var JiraClient = require('jira-connector');
var prompt = require('prompt');
var config = require('config');
var _ = require('lodash');
var Q = require('q');
var ProjectClient = new require('./clients/project');
var ComponentClient = new require('./clients/component');
var IssueClient = new require('./clients/issue');
var jsonExporter = require('./utils/json-exporter');
var JsonImporter = require('./utils/json-importer');

var host = config.get('host');
var username = config.get('username');
var exportFolder = config.get('exportFolder');

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
    console.log('Authentication successful');
    var projectClient = new ProjectClient(jira);
    var issueClient = new IssueClient(jira);
    var componentClient = new ComponentClient(jira);
    var projects = projectClient.getProjects();
    projects.then(function (projects) {
        jsonExporter.exportTo('projects.json', projects);
        var requestQuery = [];
        _.each(projects, function (project) {
            var projIssues = issueClient.getIssues(project);
            var projectIssuesPromise = projIssues.then(function (projIssues) {
                jsonExporter.exportTo('issues\\' + project.name + '.json', projIssues);
            });
            var projectComponents = componentClient.getComponents(project);
            var projectComponentsPromise = projectComponents.then(function (projectComponents) {
                jsonExporter.exportTo('components\\' + project.name + '.json', projectComponents);
            });
            requestQuery.push(projectIssuesPromise);
            requestQuery.push(projectComponentsPromise);
        });
        return Q.all(requestQuery).then(function () {
            console.log('Job done.');
            var jsonImporter = new JsonImporter(exportFolder);
            jsonImporter.importProjects();
            jsonImporter.upload();
        });
    });
});
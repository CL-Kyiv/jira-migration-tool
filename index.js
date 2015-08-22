var JiraClient = require('jira-connector');
var prompt = require('prompt');
var config = require('config');
var _ = require('lodash');
var ProjectClient = new require('./clients/project');
var IssueClient = new require('./clients/issue');
var jsonExporter = require('./utils/json-exporter');

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
    var projects = projectClient.getProjects();
    projects.then(function (projects) {
        jsonExporter.exportTo('projects.json', projects);
        _.each(projects, function (project) {
            var projIssues = issueClient.getIssues(project);
            projIssues.then(function (projIssues) {
                jsonExporter.exportTo('issues\\' + project.name + '.json', projIssues);
            })
        })
    });
});
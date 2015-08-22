var JiraClient = require('jira-connector');
var prompt = require('prompt');
var config = require('config');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');


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
            type: 'string',
            required: true,
            hidden: true
        }
    }
};

prompt.start();

//prompt.get(prompts, function (err, options) {

var checkError = function (err) {
    if (err) {
        throw new Error(err.message);
    }
};

var uploadJson = function (file, data) {
    data = JSON.stringify(data, null, 4);
    var filePath = path.join(__dirname, exportFolder, file);
    fs.writeFile(filePath, data, {flag: 'w+'}, function (err) {
        checkError(err);
    });
};

var projectsReqCallback = function (error, projects) {
    checkError(error);
    console.log('Available projects: \n\t' + _.pluck(projects, 'name').join('\n\t'));
    uploadJson('projects.json', projects);
    var requestProjectIssue = function (project) {
        var projectIssuesReqCallback = function (error, response) {
            var issues = response.issues;
            checkError(error);
            console.log('Available issues for project : ' + project.name);
            _.each(issues, function (issue) {
                console.log('\t' + issue.key + ' / ' + issue.fields.summary);
            });
            uploadJson('issues/' + project.name + '.json', issues);
        };
        jira.search.search({
            jql: 'project = "' + project.name + '"'
        }, projectIssuesReqCallback);
    };
    _.each(projects, requestProjectIssue);
};

var jira = new JiraClient({
    //host: options.host,
    host: host,
    basic_auth: {
        //username: options.username,
        username: username,
        //password: options.password
        password: 'test'
    }
});

console.log('Authentication successful');
jira.project.getAllProjects(null, projectsReqCallback);




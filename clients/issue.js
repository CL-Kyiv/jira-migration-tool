var wrapPromise = require('./../utils/promise-wrapper');
var IssueClient = module.exports = function (jira) {
    this.getIssues = function (project) {
        var issues = wrapPromise(jira.search, 'search', {
            jql: 'project = "' + project.name + '"'
        });
        return issues.then(function(response) {
            return response.issues;
        });
    }
};
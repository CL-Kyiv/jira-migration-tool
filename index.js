var JiraClient = require('jira-connector');

var jira = new JiraClient( {
    host: 'test.atlassian.net',
    basic_auth: {
        username: 'test',
        password: 'test'
    }
});
jira.issue.getIssue({
    issueKey: 'TEST-1'
}, function(error, issue) {
    console.log(issue.fields.summary);
});

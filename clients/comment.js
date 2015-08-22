var wrapPromise = require('./../utils/promise-wrapper');
var CommentClient = module.exports = function (jira) {
    this.getComments = function (issue) {

        var comments = wrapPromise(jira.issue, 'getComments', {
            issueKey: issue.key
        });
        return comments.then(function(response) {
            return response.comments;
        });
    }
};
var wrapPromise = require('./../utils/promise-wrapper');
var Q = require('q');
var pageSize = 100;
var IssueClient = module.exports = function (jira) {
    this.getIssues = function (project, progressCallbackFn) {
        var resultedIssues = [];
        var makeRequest = function (page) {
            return wrapPromise(jira.search, 'search', {
                jql: 'project = "' + project.name + '" order by key ASC',
                maxResults: pageSize,
                startAt: pageSize * page,
                expand: ['editmeta,renderedFields,transitions,changelog,operations']
            });
        };
        var deferred = Q.defer();
        makeRequest(0).then(function (response) {
            var requestQueue = [];
            var total = response.total;
            Array.prototype.push.apply(resultedIssues, response.issues);
            var totalRequests = Math.ceil((total / pageSize));
            progressCallbackFn(resultedIssues.length / total, resultedIssues.length, total);
            for (var i = 1; i < totalRequests; i++) {
                (function (page) {
                    requestQueue.push(makeRequest(page).then(function (response) {
                        Array.prototype.push.apply(resultedIssues, response.issues);
                        progressCallbackFn(resultedIssues.length / total, resultedIssues.length, total);
                    }));
                })(i)
            }
            return Q.all(requestQueue).then(function () {
                deferred.resolve(resultedIssues);
            })
        });
        return deferred.promise;
    }
};
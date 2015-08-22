var wrapPromise = require('./../utils/promise-wrapper');
var Q = require('q');
var _ = require('lodash');
var ProjectClient = module.exports = function (jira) {
    this.getProject = function (key) {
        return wrapPromise(jira.project, 'getProject', {
            projectIdOrKey: key
        });
    };
    this.getProjects = function () {
        var that = this;
        var projects = wrapPromise(jira.project, 'getAllProjects', null);
        return projects.then(function (projects) {
            var projects = _.map(projects, function (project) {
                return that.getProject(project.key)
            });
            return Q.all(projects)
        })
    }
};
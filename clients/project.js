var wrapPromise = require('./../utils/promise-wrapper');
var Q = require('q');
var _ = require('lodash');
var ProjectClient = module.exports = function (jira) {
    var getProject = function (key) {
        return wrapPromise(jira.project, 'getProject', {
            projectIdOrKey: key
        });
    };
    this.getProjects = function () {
        var projects = wrapPromise(jira.project, 'getAllProjects', null);
        return projects.then(function (projects) {
            var projects = _.map(projects, function (project) {
                return getProject(project.key)
            });
            return Q.all(projects)
        })
    };

    this.getComponents = function(key){
        return wrapPromise(jira.project, 'getComponents', {
            projectIdOrKey: key
        });
    };
    var getUser = function(userName){
        return wrapPromise(jira.user, 'getUser', {
            username: userName,
            expand:"groups"
        });
    };
    this.getProjectUsers = function(key){
        var users = wrapPromise(jira.user, 'searchAssignable', {
            project: key
        });
        return users;
        //return users.then(function(users){
        //    var userPromises = _.map(users,function(user){
        //       return getUser(user.name);
        //    });
        //   return Q.all(userPromises);
        //});
    }
};
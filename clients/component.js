var wrapPromise = require('./../utils/promise-wrapper');
var ComponentClient = module.exports = function (jira) {
    this.getComponents = function (project) {

        var components = wrapPromise(jira.project, 'getComponents', {
            projectIdOrKey: project.key
        });
        return components;
    }
};
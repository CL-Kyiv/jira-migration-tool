var path = require('path');
var config = require('config');
var _ = require('lodash');
var fs = require('fs');
var importFolder = config.get('importFolder');
var JsonImporter = function (sourcePath) {
    this.sourcePath = sourcePath;
    this.data = {
        users: [],
        links: [],
        projects: []
    }
};

JsonImporter.prototype.importProjects = function () {
    var that = this;
    var components = Object.create(null);
    var issues = Object.create(null);
    var comments = Object.create(null);

    var projects = require(path.join('..', this.sourcePath, 'projects.json'));
    _.each(projects, function (project) {
        components[project.name] = require(path.join('..', that.sourcePath, 'components', project.name + '.json'));
        issues[project.name] = require(path.join('..', that.sourcePath, 'issues', project.name + '.json'));
        comments[project.name] = Object.create(null);
        _.each(issues[project.name], function (issue) {
            if (fs.existsSync(path.join(__dirname, '..', that.sourcePath, 'comments', project.name, issue.key))) {
                comments[project.name][issue.key] = require(path.join('..', that.sourcePath, 'comments', project.name, issue.key, 'comments.json'));
            }
        });
    });
    var projectMapFn = function (project) {

        var projectVersionsMapFn = function (version) {
            return {
                name: version.name,
                released: version.released,
                releasedDate: version.releasedDate
            };
        };

        var projectComponentsMapFn = function (component) {
            return {
                name: component.name,
                lead: component.lead && component.lead.name,
                description: component.description
            }
        };

        var projectIssuesMapFn = function (issue) {

            var issueCommentsMapFn = function (comment) {
                return {
                    body: comment.body,
                    author: comment.author && comment.author.name,
                    created: comment.created
                }
            };

            return {
                key: issue.key,
                status: issue.fields.status && issue.fields.status.name,
                reporter: issue.fields.reporter && issue.fields.reporter.name,
                summary: issue.fields.summary,
                priority: issue.fields.priority && issue.fields.priority.name,
                externalId: issue.id,
                comments: comments[project.name][issue.key] && _.map(comments[project.name][issue.key], issueCommentsMapFn)
            }
        };


        return {
            name: project.name,
            key: project.key,
            description: project.description,
            versions: _.map(project.versions, projectVersionsMapFn),
            components: _.map(components[project.name], projectComponentsMapFn),
            issues: _.map(issues[project.name], projectIssuesMapFn)
        };
    };
    this.data.projects = _.map(projects, projectMapFn)
};

JsonImporter.prototype.upload = function () {
    var importPath = path.join(__dirname, '..', importFolder);
    var data = JSON.stringify(this.data, null, 4);
    if (!fs.existsSync(importPath)) {
        fs.mkdirSync(importPath);
    }
    fs.writeFileSync(path.join(importPath, 'import.json'), data, {flag: 'w+'});
};
module.exports = JsonImporter;

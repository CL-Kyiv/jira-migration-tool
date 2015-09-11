var path = require('path');
var config = require('./../jmt.json');
var Q = require('q');
var wrapPromise = require('./promise-wrapper');
var _ = require('lodash');
var fs = require('fs');
var exportFolder = config.output;
var JsonImporter = function (sourcePath) {
    this.sourcePath = sourcePath;
    this.data = {
        users: [],
        links: [],
        projects: []
    }
};

JsonImporter.prototype.importProject = function (project) {
    var that = this;
    var comments = Object.create(null);
    var readIssues = function () {
        var files = wrapPromise(fs, 'readdir', path.join(__dirname, '..', exportFolder, project.name, 'issues'));
        return files.then(function (files) {
            var issuesData = _.map(files, function (file) {
                return wrapPromise(fs, 'readFile', path.join(__dirname, '..', exportFolder, project.name, 'issues', file))
            });
            return Q.all(issuesData).then(function (data) {
                var json = _.map(data, function (file) {
                    return JSON.parse(file.toString('utf-8'));
                });
                var issues = [];
                _.each(json, function (part) {
                    issues = Array.prototype.concat.call(issues, part);
                });
                return issues;
            });
        });
    };
    var readComments = function () {
        var files = wrapPromise(fs, 'readdir', path.join(__dirname, '..', exportFolder, project.name, 'comments'));
        return files.then(function (files) {
            var commentsData = _.map(files.slice(0, 1000), function (file) {
                return wrapPromise(fs, 'readFile', path.join(__dirname, '..', exportFolder, project.name, 'comments', file)).then(function (fileContent) {
                    return {
                        issueKey: file.split('.')[0],
                        comments: JSON.parse(fileContent.toString('utf-8'))
                    }
                })
            });

            return Q.all(commentsData).then(function (data) {

                return data;
            }, function (err) {

            });
        });
    };
    var issues = readIssues();

    var comments = readComments();
    //var projects = require(path.join('..', this.sourcePath, 'projects.json'));
    //_.each(projects, function (project) {
    //issues = require(path.join('..', that.sourcePath, 'issues', project.name + '.json'));
    //comments[project.name] = Object.create(null);
    //_.each(issues[project.name], function (issue) {
    //    if (fs.existsSync(path.join(__dirname, '..', that.sourcePath, 'comments', project.name, issue.key))) {
    //        comments[project.name][issue.key] = require(path.join('..', that.sourcePath, 'comments', project.name, issue.key, 'comments.json'));
    //    }
    //});
    //});
    var buildProject = function (project) {

        var projectVersionsMapFn = function (version) {
            return {
                name: version.name,
                released: version.released
            };
        };



        return Q.all([comments, issues]).then(function (data) {
            var projectIssuesMapFn = function (issue) {

                var issueCommentsMapFn = function (comment) {
                    return {
                        body: comment.body,
                        author: comment.author && comment.author.name,
                        created: comment.created
                    }
                };
                var issueComments = _.findWhere(comments, {issueKey: issue.key});
                issueComments = issueComments && issueComments.comments || [];
                return {
                    key: issue.key,
                    status: issue.fields.status && issue.fields.status.name,
                    reporter: issue.fields.reporter && issue.fields.reporter.name,
                    summary: issue.fields.summary,
                    priority: issue.fields.priority && issue.fields.priority.name,
                    externalId: issue.id,
                    comments: _.map(issueComments, issueCommentsMapFn)
                }
            };
            var issues = data[1];
            var comments = data[0];
            return {
                name: project.name,
                key: project.key,
                description: project.description,
                versions: _.map(project.versions, projectVersionsMapFn),
                issues: _.map(issues, projectIssuesMapFn)
            };
        });

    };
    buildProject(project).then(function(data) {
        var outFile = path.join(__dirname, '..', exportFolder, project.name, 'output.json');
        if(fs.existsSync(outFile)){
            fs.unlinkSync(outFile)
        }
        fs.writeFileSync(outFile, JSON.stringify(data, null, 4));
    });
    //this.data.projects = buildProject(project);
};

//JsonImporter.prototype.upload = function () {
//    var importPath = path.join(__dirname, '..', importFolder);
//    var data = JSON.stringify(this.data, null, 4);
//    if (!fs.existsSync(importPath)) {
//        fs.mkdirSync(importPath);
//    }
//    fs.writeFileSync(path.join(importPath, 'import.json'), data, {flag: 'w+'});
//};
module.exports = JsonImporter;

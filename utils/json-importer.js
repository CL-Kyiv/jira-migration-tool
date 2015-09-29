var path = require('path');
var Q = require('q');
var wrapPromise = require('./promise-wrapper');
var _ = require('lodash');
var winston = require('winston');
var fs = require('fs');
var FileQueue = require('filequeue');
var fq = new FileQueue(100);

var importFn = function (project) {
    var exportFolder = require('./../jmt.json').output;

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
                return [].concat.apply([], json);
            });
        });
    };

    var readComments = function () {
        var files = wrapPromise(fs, 'readdir', path.join(__dirname, '..', exportFolder, project.name, 'comments'));
        return files.then(function (files) {
            var commentsData = _.map(files, function (file) {
                return wrapPromise(fq, 'readFile', path.join(__dirname, '..', exportFolder, project.name, 'comments', file)).then(function (fileContent) {
                    return {
                        issueKey: file.split('.')[0],
                        comments: JSON.parse(fileContent.toString('utf-8'))
                    }
                })
            });
            return Q.all(commentsData).then(function (data) {
                return data;
            }, function (err) {
                debugger;
            });
        });
    };

    var issues = readIssues();
    var comments = readComments();

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
                    labels: issue.fields.labels,
                    comments: _.map(issueComments, issueCommentsMapFn)
                }
            };

            var issues = data[1];
            var comments = data[0];

            return{
                users:[],
                links:[],
                projects:[
                    {
                        name: project.name,
                        key: project.key,
                        description: project.description,
                        versions: _.map(project.versions, projectVersionsMapFn),
                        issues: _.map(issues, projectIssuesMapFn)
                    }
                ]
            };
        });
    };

    var projectImportData = buildProject(project);
    return projectImportData.then(function (data) {
        var outFile = path.join(__dirname, '..', exportFolder, project.name, 'output.json');
        if (fs.existsSync(outFile)) {
            fs.unlinkSync(outFile)
        }
        var skipNulls = function(key,value){
            if(value==null)
                return undefined;
            return value;
        };
        fs.writeFileSync(outFile, JSON.stringify(data, skipNulls, 4));
    });
};

module.exports = importFn;

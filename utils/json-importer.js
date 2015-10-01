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

    var readSchema = function () {
        var schemaFile = "schema.json";
        var readSchemaFile = wrapPromise(fq, 'readFile', path.join(__dirname, '..', exportFolder, project.name, schemaFile))
            .then(function (fileContent) {
            return JSON.parse(fileContent.toString('utf-8'));
        });
        var namesFile = "names.json";
        var readNamesFile = wrapPromise(fq, 'readFile', path.join(__dirname, '..', exportFolder, project.name, namesFile))
            .then(function (fileContent) {
                return JSON.parse(fileContent.toString('utf-8'));
            });
        return Q.all([readSchemaFile, readNamesFile]).then(function(result){
            var schema = result[0];
            schema.names = result[1];
            return schema;
        })
    };

    var issues = readIssues();
    var comments = readComments();
    var schema = readSchema();

    var buildProject = function (project) {

        var projectVersionsMapFn = function (version) {
            return {
                name: version.name,
                released: version.released
            };
        };

        return Q.all([comments, issues,schema]).then(function (data) {
            var comments = data[0];
            var issues = data[1];
            var schema = data[2];
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
                var fields = issue.fields;
                var customFieldValues = [];
                if(fields.customfield_10160 && schema.customfield_10160 && schema.names.customfield_10160){
                    customFieldValues.push({
                        fieldName: schema.names.customfield_10160,
                        fieldType: schema.customfield_10160.custom,
                        value: fields.customfield_10160
                    });
                }
                return {
                    key: issue.key,
                    status: fields.status && fields.status.name,
                    reporter: fields.reporter && fields.reporter.name,
                    summary: fields.summary,
                    priority: fields.priority && fields.priority.name,
                    externalId: issue.id,
                    labels: fields.labels,
                    description: fields.description && fields.description,
                    fixedVersions: fields.fixVersions && _.map(fields.fixVersions,function(version){
                        return version.name;
                    }),
                    components: fields.components && _.map(fields.components,function(component){
                        return component.name;
                    }),
                    assignee:fields.assignee && fields.assignee.name,
                    affectedVersions: fields.versions && _.map(fields.versions,function(version){
                        return version.name;
                    }),
                    issueType:fields.issuetype && fields.issuetype.name,
                    resolution:fields.resolution && fields.resolution.name,
                    created:fields.created && fields.created,
                    updated:fields.updated && fields.updated,
                    estimate:fields.customfield_10153 && fields.customfield_10153,
                    comments: _.map(issueComments, issueCommentsMapFn),
                    customFieldValues:customFieldValues
                }
            };


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

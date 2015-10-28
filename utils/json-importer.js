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

    var readUsers = function () {
        var usersFile = "users.json";
        var readUsersFile = wrapPromise(fq, 'readFile', path.join(__dirname, '..', exportFolder, project.name, usersFile))
            .then(function (fileContent) {
                return JSON.parse(fileContent.toString('utf-8'));
            });
        return readUsersFile;
    };

    var readComponents = function () {
        var componentsFile = "components.json";
        var readComponentsFile = wrapPromise(fq, 'readFile', path.join(__dirname, '..', exportFolder, project.name, componentsFile))
            .then(function (fileContent) {
                return JSON.parse(fileContent.toString('utf-8'));
            });
        return readComponentsFile;
    };

    var issues = readIssues();
    var comments = readComments();
    var schema = readSchema();
    var users = readUsers();
    var components = readComponents();

    var buildProject = function (project) {

        var projectVersionsMapFn = function (version) {
            return {
                name: version.name,
                released: version.released
            };
        };

        return Q.all([comments, issues,schema, users,components])
            .spread(function (comments,issues,schema,users,components) {
            var names = _.invert(schema.names);
            var links = [];
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
                var customFieldNames = ['WB Comment','Found Build #','Fixed Build #'];
                _.each(customFieldNames,function(customFieldName){
                    var customFieldId = names[customFieldName];
                    if(customFieldId && fields[customFieldId] && schema[customFieldId]){
                        customFieldValues.push({
                            fieldName: customFieldName,
                            fieldType: schema[customFieldId].custom,
                            value: fields[customFieldId]
                        });
                    }
                });
                if(fields.subtasks){
                    links = links.concat(_.map(fields.subtasks,function(subtask){
                        return {
                            "name": "sub-task-link",
                            "sourceId": issue.id,
                            "destinationId": subtask.id
                        };
                    }));
                }
                if(fields.issuelinks){
                    links = links.concat(_.map(fields.issuelinks,function(issueLink){
                        return {
                            "name": issueLink.type.name,
                            "sourceId": issue.id,
                            "destinationId": issueLink.inwardIssue && issueLink.inwardIssue.id || issueLink.outwardIssue && issueLink.outwardIssue.id
                        }
                    }));
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
                    //estimate:fields.customfield_10153 && fields.customfield_10153,
                    comments: _.map(issueComments, issueCommentsMapFn),
                    customFieldValues:customFieldValues
                }
            };
            var componentsMap = function(component){
                return component.name;
            };
            return{
                users: _.map(users,function(user){
                    return{
                        "name":user.name,
                        "fullname":user.displayName,
                        "active":user.active
                    }
                }),
                links: links,
                projects:[
                    {
                        name: project.name,
                        key: project.key,
                        description: project.description,
                        versions: _.map(project.versions, projectVersionsMapFn),
                        components: _.map(components, componentsMap),
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
            if(value==null || (_.isArray(value) && value.length==0))
                return undefined;
            return value;
        };
        fs.writeFileSync(outFile, JSON.stringify(data, skipNulls, 4));
    });
};

module.exports = importFn;

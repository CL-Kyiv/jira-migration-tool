var request = require('request');
var wrapPromise = require('./../utils/promise-wrapper');
var fs = require('fs');
var Q = require('q');
var _ = require('lodash');
var util = require('util');
var config = require('./../jmt.json');
var exportFolder = config.output;
var path = require('path');
var winston = require('winston');
var progress = require('request-progress');

var CommentsClient = module.exports = function (jira) {

    var createDir = function (project) {
        if (!fs.existsSync(path.join(__dirname, '..', exportFolder, project, 'comments'))) {
            fs.mkdirSync(path.join(__dirname, '..', exportFolder, project, 'comments'));
        }
    };
    var mapIssues = function (issues) {
        return _.map(issues, function (issue) {
            return {
                id: issue.id,
                key: issue.key
            }
        });
    };
    var RequestQueue = function (issues, jira, maxSize, project) {
        this._issues = issues;
        this.maxSize = maxSize || 100;
        this._storage = Object.create(null);
        this.jira = jira;
        this.errors = [];
        this.project = project;

        this.total = issues.length;
        this.progress = 0;
        this._deferred = Q.defer();
        this.promise = this._deferred.promise;
    };

    RequestQueue.prototype.cleanQueue = function () {
        var that = this;
        _.each(this._storage, function (requestPromise, issue) {
            if (requestPromise.isFulfilled()) {
                delete that._storage[issue];
            }
        });
    };
    RequestQueue.prototype.digestOnceFunc = function () {
        var that = this;
        try {
            this.cleanQueue();
            while (this.hasFree() && this._issues.length) {
                this.enqueueRequest();
            }
        }
        catch (e) {
            winston.error(util.inspect(e));
            that._deferred.reject(e);
        }
    };

    RequestQueue.prototype.hasFree = function () {
        return _.keys(this._storage).length < this.maxSize;
    };

    //RequestQueue.prototype.getUrl = function (issue) {
    //    return 'https://' + this.jira.host + '/secure/attachmentzip/' + issue.id + '.zip'
    //};

    RequestQueue.prototype.getFileName = function (issueKey) {
        return path.join(__dirname, '..', exportFolder, this.project, 'comments', issueKey + '.comments.json');
    };

    RequestQueue.prototype.enqueueRequest = function () {
        var that = this;
        var issue = this._issues.pop();
        //var url = this.getUrl(issue);

        var makeRequest = function (issueKey, jira) {
            var deferred = Q.defer();

            var comments = wrapPromise(jira.issue, 'getComments', {
                issueKey: issueKey
            });
            comments.then(function (response) {
                var comments = response.comments;
                var file = that.getFileName(issueKey);
                if (comments.length) {
                    fs.writeFile(file, JSON.stringify(comments, null, 4), {flag: 'w+'}, function (err) {
                        if (err) {
                            that.errors.push(err);
                            deferred.reject(err);
                            winston.info(util.format('error during file writing %s (%d/%d)', file, ++that.progress, that.total));
                            return;
                        }
                        deferred.resolve(file);
                        winston.info(util.format('%s has been downloaded(%d/%d)', file, ++that.progress, that.total));
                    });

                } else {
                    deferred.resolve(file);
                    winston.info(util.format('%s has been skipped(%d/%d)', file, ++that.progress, that.total));
                }
            });
            comments.fail(function (err) {
                that.errors.push(err);
                deferred.reject(err);
            });
            //var requestHandler = function (err, response, body) {
            //    if (err) {
            //        that.errors.push(err);
            //        deferred.reject(err);
            //    }
            //    if (parseInt(response.headers['content-length']) == 22) {
            //        fs.unlinkSync(file);
            //    }
            //    winston.info(util.format('%s has been downloaded(%d/%d)', file, ++that.progress, that.total));
            //};
            //progress(
            //    request({
            //        jar: false,
            //        auth: jira.basic_auth,
            //        method: 'GET',
            //        uri: url
            //    }, requestHandler),
            //    {
            //        throttle: 3000
            //    })
            //    .on('progress', function (state) {
            //        // The properties bellow can be null if response does not contain
            //        // the content-length header
            //        winston.info(util.format('%s(%d%%)', file, state.percent));
            //    })
            //    .on('error', function (err) {
            //        console.log(err);
            //    }).pipe(fileStream);

            return deferred.promise;
        };

        this._storage[issue.key] = makeRequest(issue.key, this.jira);
    };

    RequestQueue.prototype.isCompleted = function () {
        return this._issues.length == 0;
    };

    RequestQueue.prototype.start = function (interval) {
        var that = this;
        var intervalId = setInterval(function () {
            if (!that.isCompleted()) {
                that.digestOnceFunc();
            } else {
                that._deferred.resolve(that.errors);
                clearInterval(intervalId);
            }
        }, interval);
    };

    this.uploadComments = function (issues) {
        var project = issues[0].fields.project.name;
        createDir(project);

        issues = mapIssues(issues);

        var queue = new RequestQueue(issues, jira, 40, project);
        queue.start(10);

        return queue.promise.then(function () {
            //winston.info('Attachments loading complete. Errors: ', util.inspect(queue.errors));
        }, function (err) {
            //winston.error('Critical error during request: Error: ', util.inspect(err));
        })
    }
};
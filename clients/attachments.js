var wrapPromise = require('./../utils/promise-wrapper');
var request = require('request');
var fs = require('fs');
var http = require('http');
var Q = require('q');
var _ = require('lodash');
var util = require('util');
var config = require('config');
var exportFolder = config.get('exportFolder');
var path = require('path');
var winston = require('winston');
var progress = require('request-progress');
var EventEmitter = require('events').EventEmitter;

var AttachmentsClient = module.exports = function (jira) {

    var createDir = function () {
        if (!fs.existsSync(path.join(__dirname, '..', exportFolder, 'attachments'))) {
            fs.mkdirSync(path.join(__dirname, '..', exportFolder, 'attachments'));
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
    var RequestQueue = function (issues, jira, maxSize) {
        this._urls = issues;
        this.maxSize = maxSize || 100;
        this._storage = Object.create(null);
        this.jira = jira;
        this.errors = [];

        this.total = issues.length;
        this.progress = 0;
        this._deferred = Q.defer();
        this.promise = this._deferred.promise;
    };

    RequestQueue.prototype.cleanQueue = function () {
        var that = this;
        _.each(this._storage, function (requestPromise, url) {
            if (requestPromise.isFulfilled()) {
                delete that._storage[url];
            }
        });
    };
    RequestQueue.prototype.digestOnceFunc = function () {
        var that = this;
        try {
            this.cleanQueue();
            while (this.hasFree() && this._urls.length) {
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

    RequestQueue.prototype.getUrl = function (issue) {
        return 'https://' + this.jira.host + '/secure/attachmentzip/' + issue.id + '.zip'
    };

    RequestQueue.prototype.getFileName = function (issue) {
        return path.join(__dirname, '..', exportFolder, 'attachments', issue.key + '.zip');
    };

    RequestQueue.prototype.enqueueRequest = function () {
        var that = this;
        var issue = this._urls.pop();
        var url = this.getUrl(issue);
        var file = this.getFileName(issue);

        var makeRequest = function (url, jira) {
            var deferred = Q.defer();
            var fileStream = fs.createWriteStream(file);
            fileStream.on('finish', function () {
                fileStream.close();
                deferred.resolve(file);
            });
            var requestHandler = function (err, response, body) {
                if (err) {
                    that.errors.push(err);
                    deferred.reject(err);
                }
                if (parseInt(response.headers['content-length']) == 22) {
                    fs.unlinkSync(file);
                }
                winston.info(util.format('%s has been downloaded(%d/%d)', file, ++that.progress, that.total));
            };
            progress(
                request({
                    jar: false,
                    auth: jira.basic_auth,
                    method: 'GET',
                    uri: url
                }, requestHandler),
                {
                    throttle: 3000
                })
                .on('progress', function (state) {
                    // The properties bellow can be null if response does not contain
                    // the content-length header
                    winston.info(util.format('%s(%d%%)', file, state.percent));
                })
                .on('error', function (err) {
                    console.log(err);
                }).pipe(fileStream);

            return deferred.promise;
        };

        this._storage[url] = makeRequest(url, this.jira);
    };

    RequestQueue.prototype.isCompleted = function () {
        return this._urls.length == 0;
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

    this.uploadAttachments = function (issues) {

        createDir();

        issues = mapIssues(issues);

        var queue = new RequestQueue(issues, jira, 40);
        queue.start(10);

        return queue.promise.then(function () {
            //winston.info('Attachments loading complete. Errors: ', util.inspect(queue.errors));
        }, function (err) {
            //winston.error('Critical error during request: Error: ', util.inspect(err));
        })
    }
};
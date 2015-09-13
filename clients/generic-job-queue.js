var _ = require('lodash');
var Q = require('q');
var JobQueue = function (inputData, maxQueueSize, jobHandler, handlerContext) {
    var inputDataMapFn = function (data, index) {
        return {
            dataItem: data,
            index: index
        }
    };

    this._handler = jobHandler;
    this._handlerContext = handlerContext || null;
    this._data = _.map(inputData, inputDataMapFn);
    this._jobStateStorage = Object.create(null);

    this.maxQueueSize = maxQueueSize;
    this.errors = [];
    this.results = [];

    this.total = inputData.length;

    this.progress = 0;
};

JobQueue.prototype.cleanQueue = function () {
    var that = this;
    _.each(this._jobStateStorage, function (jobPromise, index) {
        if (jobPromise.isFulfilled()) {
            delete that._jobStateStorage[index];
        }
    });
};
JobQueue.prototype.digestOnceFunc = function () {
    this.cleanQueue();
    while (this.hasFree() && this._data.length) {
        this.enqueueJob();
    }
};

JobQueue.prototype.hasFree = function () {
    return _.keys(this._jobStateStorage).length < this.maxQueueSize;
};

JobQueue.prototype.enqueueJob = function () {
    var that = this;
    var input = this._data.shift();

    var makeJob = function (dataItem, index) {
        var job = that._handler.call(that._handlerContext, dataItem, index, that.total);

        var jobSuccessHandler = function (result) {
            ++that.progress;
            that.results.push(result);
            return result;
        };
        var jobFailHandler = function (err) {
            that.errors.push(err);
            throw err;
        };
        return job.then(jobSuccessHandler, jobFailHandler);
    };

    this._jobStateStorage[input.index] = makeJob(input.dataItem, input.index);
};

JobQueue.prototype.isCompleted = function () {
    return this._data.length == 0;
};

JobQueue.prototype.start = function (interval) {
    var that = this;
    var deferred = Q.defer();
    var intervalId = setInterval(function () {
        if (!that.isCompleted()) {
            if (that.errors.length) {
                deferred.reject(that.errors);
                clearInterval(intervalId);
            } else {
                that.digestOnceFunc();
            }
        } else {
            deferred.resolve(that.results);
            clearInterval(intervalId);
        }
    }, interval);
    return deferred.promise;
};

module.exports = JobQueue;
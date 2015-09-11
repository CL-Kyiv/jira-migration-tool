var JobQueue = function (inputData, maxQueueSize, jobHandler, handlerContext) {
    var inputDataMapFn = function(data, index) {
        return {
            dataItem: data,
            hash: index
        }
    };

    this._handler = jobHandler;
    this._handlerContext = handlerContext || null;
    this._data = inputDataMapFn(inputData);
    this._jobStateStorage = Object.create(null);
    this._deferred = Q.defer();
    
    this.maxQueueSize = maxQueueSize || 100;
    //this.jira = jira;
    this.errors = [];
    //this.project = project;

    this.total = inputData.length;
    
    this.progress = 0;
    this.promise = this._deferred.promise;
};

JobQueue.prototype.cleanQueue = function () {
    var that = this;
    _.each(this._jobStateStorage, function (jobPromise, hash) {
        if (jobPromise.isFulfilled()) {
            delete that._jobStateStorage[hash];
        }
    });
};
JobQueue.prototype.digestOnceFunc = function () {
    var that = this;
    try {
        this.cleanQueue();
        while (this.hasFree() && this._data.length) {
            this.enqueueJob();
        }
    }
    catch (e) {
        winston.error(util.inspect(e));
        that._deferred.reject(e);
    }
};

JobQueue.prototype.hasFree = function () {
    return _.keys(this._jobStateStorage).length < this.maxQueueSize;
};

JobQueue.prototype.getFileName = function (issueKey) {
    return path.join(__dirname, '..', exportFolder, this.project, 'comments', issueKey + '.comments.json');
};

JobQueue.prototype.enqueueJob = function (input) {
    var that = this;
    var issue = this._data.pop();

    var makeJob = function (dataItem) {
        var jobDeferred = Q.defer();
        var job = that._handler.call(that._handlerContext, dataItem);
        var jobSuccessHandler = function() {

        };
        //var comments = wrapPromise(jira.issue, 'getComments', {
        //    issueKey: issueKey
        //});
        //comments.then(function (response) {
        //    var comments = response.comments;
        //    var file = that.getFileName(issueKey);
        //    if (comments.length) {
        //        fs.writeFile(file, JSON.stringify(comments, null, 4), {flag: 'w+'}, function (err) {
        //            if (err) {
        //                that.errors.push(err);
        //                deferred.reject(err);
        //                winston.info(util.format('error during file writing %s (%d/%d)', file, ++that.progress, that.total));
        //                return;
        //            }
        //            deferred.resolve(file);
        //            winston.info(util.format('%s has been downloaded(%d/%d)', file, ++that.progress, that.total));
        //        });
        //
        //    } else {
        //        deferred.resolve(file);
        //        winston.info(util.format('%s has been skipped(%d/%d)', file, ++that.progress, that.total));
        //    }
        //});
        //comments.fail(function (err) {
        //    that.errors.push(err);
        //    deferred.reject(err);
        //});
        return jobDeferred.promise;
    };

    this._jobStateStorage[input.hash] = makeJob(input.dataItem);
};

JobQueue.prototype.isCompleted = function () {
    return this._data.length == 0;
};

JobQueue.prototype.start = function (interval) {
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
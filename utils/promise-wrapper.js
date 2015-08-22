var Q = require('q');
var wrapper = function (context, fn) {
    var deferred = Q.defer();
    var args = Array.prototype.slice.call(arguments, 2);
    var callback = function () {
        var result = Array.prototype.slice.call(arguments, 1);
        var error = arguments[0];
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve(result.length == 1 ? result[0] : result);
        }
    };
    args.push(callback);
    context[fn].apply(context, args);
    return deferred.promise;
};
module.exports = wrapper;
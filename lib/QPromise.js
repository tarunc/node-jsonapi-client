var q = require('Q');
var _ = require('lodash/dist/lodash.underscore');

var Promise = q.Promise || q.makePromise;

Promise.prototype.create = function (args) {
    return this.invoke('create', args);
};

Promise.prototype.save = function () {
    return this.invoke('save');
};

Promise.prototype.refresh = function () {
    return this.invoke('refresh');
};

Promise.prototype.get = function (name) {
    return this.then(function(val) {
        name = (name + '').split('.');
        var base = name.shift(), rest = name.join('.'), ret;

        if (_.isFunction(val.get)) {
          ret = val.get.call(val, base);
        } else {
          ret = val[name];
        }

        if (rest) {
          return q(ret).get(rest);
        }

        return ret;
    });
};

Promise.prototype.set = function(path, value) {
    // simply a smarter set method
    return this.then(function (ret) {
        var p = path.split('.');
        var f = p.pop();

        return (p ? ret.get(p.join('.')) : q(ret)).then(function (obj) {
            obj[f] = value;
            return ret;
        });
    });
};

module.exports = Promise;

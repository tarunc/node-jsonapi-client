/**
 * Module dependencies.
 */
// Required To Parse URLs
// Paged Objects currently handle there own url parsing completely
var url = require('url');

// Promise Library
var Q = require('q');

// Utility Belt
var _ = require('lodash/dist/lodash.underscore');

function Page(api, url) {
  this._adapter = api;
  this._url = url;
  this._objects = {};
  this._meta = null;
}

Page.prototype._load = function(meta, list) {
  this._meta = meta;

  for (var n in list) {
    this._objects[n * 1 + this._meta.offset * 1] = list[n];
  }
};

Object.defineProperty(Page.prototype, 'length', {
  get: function() {
    var self = this;

    if (this._meta) {
      return Q(this._meta.total);
    } else {
      return this.get(0).then(function() {
        return self._meta.total;
      });
    }
  }
});

Page.prototype.create = function(args) {
  var query = url.parse(this._url, true);
  return this._adapter.create(query.pathname, args);
};

Page.prototype.get = function(index) {
  index *= 1;

  if (this._objects[index]) {
    if (_.isString(this._objects[index])) {
      return this._adapter.get(this._objects[index]);
    } else if (Q.isPromise(this._objects[index])) {
      // if the object is being requested, but has not resolved yet
      // the object will be a promise, which will resolve once the
      // object is ready
      return this._objects[index].then(function() {
        if (_.isString(this._objects[index])) {
          return this._adapter.get(this._objects[index]);
        } else {
          return this._objects[index];
        }
      });
    } else {
      return this._objects[index];
    }
  }

  var self = this;
  var look = index - index % 10;
  var query = url.parse(this._url, true);
  query.query.limit = 10;
  query.query.offset = look;

  var href = url.format(query);
  var defered = Q.defer();

  for (var a = look; a < look + 10; a++) {
    this._objects[a] = defered.promise;
  }

  return this._adapter._request('GET', href, {}, true).then(function(list) {
    console.log('list', list.meta, list)
    self._load(list.meta, list);
    defered.resolve();

    if (!self._objects[index]) {
      throw new Error('WHAT');
    }

    // return self._objects[index] ? self._adapter.get(self._objects[index]) : undefined;
    if (_.isString(self._objects[index])) {
      return self._adapter.get(self._objects[index]);
    } else {
      return self._objects[index];
    }
  });
};

Page.prototype.filter = function(name_or_dict, value) {
  var dict = {};

  if (_.isString(name_or_dict)) {
    dict[name_or_dict] = value;
  } else {
    dict = name_or_dict;
  }

  var query = url.parse(this._url, true);
  _.extend(query.query, dict);

  var p = new Page(this._adapter, url.format(query));
  return p;
};

Page.prototype.range = function(start, finish) {
  var ret = [];
  for (var a = start; a < finish; a++) {
    ret.push(this.get(a));
  }

  return Q.all(ret);
};

Page.prototype.first = function() {
  var self = this;

  return this.get(0)
    .catch (function(err) {
    if (!_.isObject(self._objects[0])) {
      return null;
    }

    return Q.reject(err); // not our error to catch
  });
};

Page.prototype.one = function() {
  var self = this;
  return this.length(function(length) {
    if (length !== 1) {
      return Q.reject(new Error('Page ' + self._url + ' does not have exactly one item, it has ' + length));
    }

    return self.get(0);
  });
};

Page.prototype.all = function() {
  var self = this;

  return this.length.then(function(length) {
    var ret = [];
    for (var a = 0; a < length; a++) {
      ret.push(self.get(a));
    }

    return Q.all(ret);
  });
};

Page.prototype.refresh = function() {
  this._objects = {};
  this._meta = null;

  return this;
};

/**
 * Expose `Page`.
 */
module.exports = Page;

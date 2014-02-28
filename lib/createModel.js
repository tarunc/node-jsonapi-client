/**
 * Module dependencies.
 */
// Basic Inflection library
// For pluralization and singularization
var inflection = require('inflection');

// Utility Belt
var _ = require('lodash/dist/lodash.underscore');

// Promise Library
var Q = require('q');

function get_member(obj, name) {
  if (_.isString(name)) {
    name = name.split('.');
  }

  if (!name || !name.length) {
    return obj;
  }

  if (!obj[name[0]]) {
    return null;
  }

  return get_member(obj[name.shift()], name);
}

function handle_bars(obj, elem) {
  if (_.isString(elem)) {
    return elem.replace(/\{([\.\w]+)\}/g, function(match, what) {
      return get_member(obj, what);
    });
  }

  if (_.isObject(elem)) {
    elem = _.extend({}, elem);

    _.each(elem, function(val, key) {
      elem[key] = handle_bars(obj, val);
    });
  }
}


/**
 * `createModel` function.
 *
 * Creates a model given an adapter and the type
 *
 * @api private
 */
function createModel(adapter, type) {
  function Model(data) {
    var self = this;
    data = data || {};

    this._adapter = adapter;
    this._type = type;

    this._update(data, true);

    _.each(adapter._routes[inflection.pluralize(type)], function(val, key) {
      if (Model.prototype[key]) {
        return;
      }

      Object.defineProperty(self, key, {
        'get': function() {
          if (this === Model.prototype) {
            return true;
          }

          var link = self._adapter._getLink(self, key);
          if (!link) {
            return Q.reject(new Error('could not find link for ' + key + ' from ' + self._type));
          }

          return self._adapter.get(link, {}, !self.links[key]);
        }
      });
    });
  };

  Model.prototype._type = type;

  Object.defineProperty(Model.prototype, 'href', {
    'get': function() {
      return this._href;
    }
  });

  Model.prototype.save = function(cb) {
    var self = this;
    cb = cb ||
    function() {};

    return this._adapter.update(this.href, this.toJSON()).then(function(payload) {
      cb(null, self);
      return self;
    }, function(err) {
      cb(err);
      return Q.reject(err);
    });
  };

  Model.prototype.get = function(what, _list) {
    var self = this;
    var pre = this._loaded ? Q() : this.refresh();

    return pre.then(function() {
      if (self[what]) {
        return Q(self[what]);
      }

      var link = self._adapter._getLink(self, what);
      if (!link) {
        return Q.reject(new Error('could not compute link ' + what + ' for ' + obj._type), null);
      }

      if (_.isUndefined(_list)) {
        _list = !self.links[what];
      }

      return self._adapter.get(link, {}, _list);
    });
  };

  Model.prototype.create = function(what, data) {
    var self = this;

    if (typeof what !== 'string') {
      data = what || {};

      return this._adapter.create(this.href, data);
    }

    var pre = this._loaded ? Q() : this.refresh();

    return pre.then(function() {
      var link;

      what = inflection.pluralize(what);

      if (!data) {
        data = {};
      }

      if (self.links[what]) {
        link = self.links[what];
      } else {
        link = self._adapter._getLink(self, what);
      }

      if (!link) {
        return Q.reject(new Error('could not find link for ' + what + ' from ' + self._type), null);
      }

      return self._adapter.create(link, data);
    });
  };

  Model.create = function(data) {
    return adapter.create(inflection.pluralize(type), data);
  };

  Model.prototype.create = function(what, data) {
    if (!_.isString(what)) {
      data = what || {};
      return this._adapter.create(this.href, data);
    }

    var self = this;

    var pre = this._loaded ? Q() : this.refresh();

    pre.then(function () {
      var link;
      what = inflection.pluralize(what);
      if (!data) {
        data = {};
      }

      if (self.links[what]) {
        link = self.links[what];
      } else {
        link = self._adapter._getLink(self, what);
      }

      if (!link) {
        return Q.reject(new Error('could not find link for ' + what + ' from ' + self._type), null);
      }

      return self._adapter.create(link, data);
    });
  };

  Model.prototype.unstore = Model.prototype.delete = function() {
    return this._adapter.delete(this.href);
  };

  Model.prototype.do = function(what, args) {
    var self = this;
    var act = this._adapter._routes[inflection.pluralize(this._type)][what];
    var collect = {};

    collect[inflection.pluralize(this._type)] = this;

    for (var n in act.fields) {
      var itm = act.fields[n];
      for (var a = 0; a < itm.length; a++) {
        if (typeof args[n] != 'undefined' && (typeof args[n] == itm[a]._type || args[n]._type == itm[a].type)) {
          args[itm[a].name || n] = itm[a].value ? handle_bars(args[n], itm[a].value) : args[n];
          if (itm[a].name && itm[a].name != n) delete args[n];
          break;
        }
      }
    }

    var url = handle_bars(collect, act.href);
    return this._adapter._request(act.method, url, args);
  };

  Model.prototype._update = function(data, incomplete) {
    // clear the object
    if (!incomplete) {
      for (var n in this) {
        if (this.hasOwnProperty(n) && n !== '_adapter' && n !== '_type') {
          delete this[n];
        }
      }
    }

    // same as init in copying over object
    this._href = data.href;
    this._setValues = {};
    this._deferred = data._deferred || false;
    this.links = data.links || {};
    this._rawData = data;
    this._loadTime = new Date();
    this._keys = _.keys(this);

    if (!this._href) {
      _.extend(this, data);
    } else {
      _.each(data, function(val, key) {
        if (['href', 'links'].indexOf(key) >= 0 || Model.prototype[key]) {
          return;
        }

        Object.defineProperty(Model.prototype, key, {
          enumerable: true,
          get: function() {
            if (this === Model.prototype) {
              return true; // not working on an object
            }

            if (this._deferred) {
              return this.get(key);
            }

            return this._setValues[key] || this._rawData[key] || val;
          },
          set: function(value) {
            this._setValues[key] = value;
          }
        });
      });
    }
  };

  Model.prototype.toJSON = function() {
    var obj = {};

    for (var n in this) {
      if (n[0] == '_' || n == 'type') {
        continue;
      }

      if (typeof this[n] == 'function') {
        continue;
      }

      obj[n] = this[n];
    }

    return obj;
  };

  Model.prototype._addAction = function(action) {
    if (Model.prototype[action]) {
      return;
    }

    Model.prototype[action] = function(args) {
      return this.do(action, args);
    };
  };

  Model.prototype.refresh = function() {
    return this._adapter.get(this.href);
  };

  Object.defineProperty(Model, 'query', {
    'get': function() {
      return adapter.list(type + 's');
    }
  });

  return Model;
};

/**
 * Expose `createModel` function.
 */
module.exports = createModel;

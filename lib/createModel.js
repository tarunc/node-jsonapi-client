var inflection = require('inflection'),
  _ = require('lodash/dist/lodash.underscore'),
  q = require('q');

function createModel(adapter, type) {
  function Model(data) {
    var self = this;
    data = data || {};

    this._adapter = this.adapter;
    this._type = type;

    this._update(data, true);

    _.each(adapter._routes[inflection.pluralize(type)], function(val, key) {
      var v = null;

      Object.defineProperty(self, key, {
        'get': function() {
          if (v) {
            return q(v);
          }

          var link = self._adapter._getLink(self, name);
          if (!link) {
            return q.reject(new Error('could not find link for ' + key + ' from ' + self._type));
          }

          return self._adapter.get(link, !self.links[key]).then(function(obj) {
            v = obj;
            return v;
          });
        }
      });
    });
  };

  Model.prototype.save = function(cb) {
    var self = this;
    cb = cb || function() {};

    return this._adapter.update(this.href, this.toJSON()).then(function(payload) {
      cb(null, self);
      return self;
    }, function(err) {
      cb(err);
      return q.reject(err);
    });
  };

  Model.prototype.get = function(what, _list) {
    var self = this;
    var pre = this._loaded ? q() : this.refresh();

    return pre.then(function() {
      if (self[what]) {
        return q(self[what]);
      }

      var link = self._adapter._getLink(self, what);
      if (!link) {
        return q.reject(new Error('could not compute link ' + what + ' for ' + obj._type), null);
      }

      return self._adapter.get(link, _list);
    });
  };

  Model.prototype.create = function(what, data) {
    var self = this;

    if (typeof what !== 'string') {
      data = what || {};

      return this._adapter.create(this.href, data).then(function(list) {
        return list[0];
      });
    }

    var pre = this._loaded ? q() : this.refresh();

    return pre.then(function() {
      var link;

      what += 's';

      if (!data) {
        data = {};
      }

      if (self.links[what]) {
        link = self.links[what];
      } else {
        link = self._adapter._getLink(self, what);
      }

      if (!link) {
        return q.reject(new Error('could not find link for ' + what + ' from ' + self._type), null);
      }

      return self._adapter.create(link, data).then(function(json) {
        return list[0];
      });
    });
  };

  Model.create = Model.prototype.create = function(data) {
    return adapter.create(type + 's', data);
  };

  Model.prototype.unstore = Model.prototype.delete = function() {
    return this._adapter.delete(this.href);
  };

  Model.prototype.do = function(what, args) {
    var self = this;
    var act = this._adapter._routes[this._type + 's'][what];
    var collect = {};

    collect[this._type + 's'] = this;

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
    return this._adapter._request(url, act.method, args).then(function(json) {
      var list = self._adapter._processResult(json);
      return list[0] || null;
    });
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
    this.links = {};
    this._rawData = data;
    this._loaded = true;
    this._loadTime = new Date();
    this._keys = Object.keys(this);

    _.extend(this, data);
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
    if (!obj.prototype[action]) {
      obj.prototype[action] = function(args) {
        return this.do(action, args);
      };
    }
  };

  // Model.prototype.list = jsonapi.prototype.list;

  Model.prototype.refresh = function() {
    var self = this;

    return this._adapter.get(this.href).then(function(list) {
      return list[0];
    });
  };

  return Model;
};

module.exports = createModel;

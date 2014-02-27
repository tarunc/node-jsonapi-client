/**
* Module dependencies.
*/
var request = require('request'),
  q = require('q'),
  url = require('url'),
  _ = require('lodash/dist/lodash.underscore'),
  debug = require('debug')('JSONAPIClient'),
  inflection = require('inflection'),
  JSONPromise = require('./JSONPromise'),
  Promise = require('./QPromise');

  var createModel = require('./createModel');

// Define some sane default options
var defaultOptions = {
  q: q,
  requestOptions: {
    headers: {
      'User-Agent': 'Node-JSONAPIClient/' +  + ' node/' + process.version
    }
  },
  processRequestOptions: _.identity,
  primaryKey: 'id'
};

/**
* `APIClient` constructor.
*
* @param {String} baseUrl - the base url to your API
* @param {Object} options - an options object
* @api public
*/
function APIClient(baseUrl, options) {
  // Base Url for it to make requests to
  this.baseUrl = /\/$/.test(baseUrl) ? baseUrl : baseUrl + '/';

  // Parse the url to extract just the host and namespace information
  var parsedUrl = url.parse(baseUrl);
  this._host = parsedUrl.protocol + '//' + parsedUrl.host;
  this._namespace = parsedUrl.pathname;

  // Extend the default options
  this.options = _.defaults(options || {}, APIClient.defaultOptions);

  // Set the default promises library
  this.q = this.options.q;

  // Copy over some default data
  this._routes = this.options.routes || {};
  this._objects = this.options.objects || {};

  // Sanitize some of the options
  this.options.requestOptions = this.options.requestOptions || {};
};

//
// Expose the version from the package.json
//
APIClient.version = require('../package.json').version;

/**
* Expose `defaultOptions` for the JSON APIClient library so that this is changable.
*/
APIClient.defaultOptions = defaultOptions;

/**
* Helper method to create an instance easily
*
* Enables use like this:
*
*     `var apiClient = require('JSONAPIClient').create("http://url.to/my/api");`
*
* @param {String} baseUrl - the url to your api
* @param {Object} options - an options object
* @api public
*/
APIClient.create = function(baseUrl, options) {
  var apiClient = new APIClient(baseUrl, options);
  return apiClient;
};

APIClient.reservedNames = ['source'];

/**
* Expose `APIClient` Library.
*/
module.exports = APIClient;

APIClient.prototype.registerType = function(type, obj) {
  debug('Creating type [%s]', type);

  if (this._objects[type]) {
    throw new Error('Already have type: ' + type);
  }

  var o = this[type] = this._objects[type] = this._createType(type);

  if (!obj) {
    return o;
  }

  _.each(obj, function (val, key) {
    this._createPromise(key);

    if (_.isFunction(val)) {
        o.prototype[key] = q.promised(val);
    }
  }, this);

  return o;
};

APIClient.prototype._createPromise = function(name) {
  if (APIClient.reservedNames.indexOf(name) >= 0) {
    return;
  }

  if (Promise[name] || Promise.prototype[name]) {
    return;
  }

  Object.defineProperty(Promise.prototype, name, {
      'get': function () {
          if (this === Promise.prototype) {
            return true; // we are not operating on a object
          }

          var self = this;
          var gotten;
          function act() {
              return q.spread([self, q.all(arguments)], function(self, args) {
                  return self[name].apply(self, args);
              });
          }

          for(var elem in Promise.prototype) {
              (function (elem) {
                  Object.defineProperty(act, elem, {
                      'get': function () {
                          // not working
                          if (!gotten) {
                            gotten = self.get(name);
                          }

                          if (typeof gotten[elem] == 'function') {
                              return function () {
                                  return gotten[elem].apply(gotten, arguments);
                              };
                          } else {
                            return gotten[elem];
                          }
                      }
                  });
              })(elem);
          }

          return act;
      }
  });
};

APIClient.prototype._getLink = function (obj, link) {
    return this.routes[obj._type + 's'][link].href.replace(/\{([\.\w]+)\}/g, function (match, what) {
        var dat = /(\w+)\.(\w+)/.exec(what);

        return obj._rawData.links[dat[2]] || obj._rawData[dat[2]];
    });
};

APIClient.prototype._createInstance = function(type, data) {
  console.log('_createInstance', type, data);
  var construct = this._objects[type];
  if(!construct) {
    construct = this.registerType(type);
  }

   var constructed = new construct(data);
   return constructed;
};

APIClient.prototype._createType = function(type) {
  return createModel(this, type);
};

/**
  @method urlPrefix
  @private
  @param {String} path
  @param {String} parentUrl
  @return {String} urlPrefix
*/
APIClient.prototype._urlPrefix = function(path, parentURL) {
  var host = this._host,
      namespace = this._namespace,
      url = [];

  if (path) {
    // Absolute path
    if (path.charAt(0) === '/') {
      if (host) {
        path = path.slice(1);
        url.push(host);
      }
    // Relative path
    } else if (!/^http(s)?:\/\//.test(path)) {
      url.push(parentURL);
    }
  } else {
    if (host) {
      url.push(host);
    }
    if (namespace) {
      url.push(namespace);
    }
  }

  if (path) {
    url.push(path);
  }

  return url.join('/');
};

/**
  Builds a URL for a given type and optional ID.

  By default, it pluralizes the type's name (for example, 'post'
  becomes 'posts' and 'person' becomes 'people'). To override the
  pluralization see [pathForType](#method_pathForType).

  If an ID is specified, it adds the ID to the path generated
  for the type, separated by a `/`.

  @method buildURL
  @param {String} type
  @param {String} id
  @returns {String} url
*/
/**
 * Look up routes based on top-level links.
 */
APIClient.prototype._buildURL = function(type, id) {
  var route = this._routes[type];
  var url = [],
      host = this._host,
      prefix = this._urlPrefix();

  if(!!route) {
    var param = new RegExp('\{(.*?)\}', 'g');

    if (id) {
      if(route.match(param)) {
        url.push(route.replace(param, id));
      } else {
        url.push(route, id);
      }
    } else {
      url.push(route.replace(param, ''));
    }

    if (prefix) {
      url.unshift(prefix);
    }

    url = url.join('/');
    if (!host && url) {
      url = '/' + url;
    }

    return url;
  }

  if (type) {
    url.push(this._pathForType(type));
  }
  if (id) {
    url.push(id);
  }

  if (prefix) {
    url.unshift(prefix);
  }

  url = url.join('/');
  if (!host && url) {
    url = '/' + url;
  }

  return url;
};

APIClient.prototype._processResult = function(payload, isList) {
  var self = this;
  var list = [];

  _.each(payload, function(objs, type) {
    if (['links', 'meta'].indexOf(type) >= 0) {
      return;
    }

    type = type.replace(/s$/, '');
    _.each(objs, function(data, i) {
      list.push(self._createInstance(type, self._normalize(data)));
    });
  });

  if (!isList) {
	  return list[0];
  }

  return list;
};

/**
  Determines the pathname for a given type.

  By default, it pluralizes the type's name (for example,
  'post' becomes 'posts' and 'person' becomes 'people').

  ### Pathname customization

  For example if you have an object LineItem with an
  endpoint of "/line_items/".

  ```js
  DS.RESTAdapter.reopen({
    pathForType: function(type) {
      var decamelized = Ember.String.decamelize(type);
      return Ember.String.pluralize(decamelized);
    };
  });
  ```

  @method pathForType
  @param {String} type
  @returns {String} path
**/
APIClient.prototype._pathForType = function(type) {
  var camelized = inflection.camelize(type);
  return inflection.pluralize(camelized);
};

APIClient.prototype._request = function(method, path, parameters, isList) {
  debug('Requesting [%s] %s with data %o', method, path, parameters);
  // Storing self for future uses
  var self = this;

  // Create the request options
  var url = this.baseUrl + path;
  var requestOptions = _.extend({
    method: method,
    url: url
  }, this.options.requestOptions);

  requestOptions.url = requestOptions.url.replace(/([^:])\/+/g, '$1/');

  if (method === 'GET' || method === 'DELETE') {
    requestOptions.qs = parameters;
  } else {
    requestOptions.json = parameters;
    // requestOptions.body = JSON.stringify(parameters);
    // requestOptions.headers = {
    //   'Content-Type': 'application/json'
    // };
  }

  // If the options defines a function to process request options
  // Run it with the request options
  if (_.isFunction(this.options.processRequestOptions)) {
    requestOptions = this.options.processRequestOptions(requestOptions);
  }

  // Create Promises
  var promise = this.q.defer();
  // Make the actual Request
  request(requestOptions, function(err, req, body) {
    // Handle errors
    if (err) {
      return promise.reject(err);
    }

    // Handle 400s
    if (req.statusCode >= 400) {
      var e = new HTTPError('Status Code: ' + req.statusCode + ' ' + _.isString(body) ? body : JSON.stringify(body, null, 4));
      return promise.reject(e);
    }

    // Handle no content case
    if(req.statusCode === 204) {
        return promise.resolve(null);
    }

    try {
        // Try to parse
        var json = _.isString(body) ? JSON.parse(req.body) : body;
        console.log(json);
        var payload = self._normalizePayload(json);
        return promise.resolve(self._processResult(payload, isList));
    } catch(error) {
        return promise.reject(error);
    }
  });

  return promise.promise;
};


/**
 * Flatten links
 */
APIClient.prototype._normalize = function(hash) {
  if (!hash) {
    return hash;
  }

  var json = {};

  for(var key in hash) {
    if(key !== 'links') {
      json[key] = hash[key];
    } else if(typeof hash[key] === 'object') {
      for(var link in hash[key]) {
        json[link] = hash[key][link];
      }
    }
  }

  this._normalizeId(hash);
  // this._normalizeAttributes(type, hash);
  // this._normalizeRelationships(type, hash);
  //
  // this._normalizeUsingDeclaredMapping(type, hash);
  //
  // if (this._normalizeHash && this._normalizeHash[prop]) {
  //   this._normalizeHash[prop](hash);
  // }
  // this._applyTransforms(type, hash);
  return hash;
};


/**
 * Extract top-level "meta", "links", and "linked" before normalizing.
 */
/**
  You can use this method to normalize all payloads, regardless of whether they
  represent single records or an array.

  For example, you might want to remove some extraneous data from the payload:

  ```js
  App.ApplicationSerializer = DS.RESTSerializer.extend({
    normalizePayload: function(type, payload) {
      delete payload.version;
      delete payload.status;
      return payload;
    }
  });
  ```

  @method normalizePayload
  @param {subclass of DS.Model} type
  @param {Object} hash
  @returns {Object} the normalized payload
*/
APIClient.prototype._normalizePayload = function(payload) {
  if(payload.meta) {
    this._extractMeta(payload.meta);
    delete payload.meta;
  }

  if(payload.links) {
    this._extractLinks(payload.links);
    delete payload.links;
  }

  if(payload.linked) {
    this._extractLinked(payload.linked);
    delete payload.linked;
  }

  return payload;
};

/**
  @method normalizeId
  @private
*/
APIClient.prototype._normalizeId = function(hash) {
  var primaryKey = this.options.primaryKey;

  if (primaryKey === 'id') {
    return;
  }

  hash.id = hash[primaryKey];
  delete hash[primaryKey];
},

/**
 * Extract top-level "linked" containing associated objects
 */
APIClient.prototype._extractLinked = function(linked) {
  var link, value, relation, store = get(this, 'store');
  for(link in linked) {
    value = linked[link];
    if (value.links) {
      for(relation in value.links) {
        value[relation]=value.links.relation;
      }
      delete value.links;
    }

    store.pushMany(inflection.singularize(link), value);
  }
};

/**
 * Override this method to parse the top-level "meta" object per type.
 */
APIClient.prototype._extractMeta = function(type, meta) {
  // no op
};

/**
 * Parse the top-level "links" object.
 */
APIClient.prototype._extractLinks = function(links) {
  var link, key, value, route;

  for(link in links) {
    key = link.split('.').pop();
    value = links[link];

    if (typeof value === 'string') {
      route = value;
    } else {
      key = value.type || key;
      route = value.href;
    }

    // strip base url
    if(route.substr(0, 4).toLowerCase() === 'http') {
      route = route.split('//').pop().split('/').slice(1).join('/');
    }

    // strip prefix slash
    if(route.charAt(0) === '/') {
      route = route.substr(1);
    }

    this._routes[inflection.singularize(key)] = route;
  }
};


APIClient.prototype.get = function(path, qs) {
  return this._request('GET', path, qs);
};

APIClient.prototype.list = function(path, qs) {
  return this._request('GET', path, qs, true);
};

APIClient.prototype.create = function(path, qs) {
  return this._request('POST', path, qs);
};

APIClient.prototype.update = function(path, qs) {
  return this._request('PUT', path, qs);
};

APIClient.prototype.delete = function(path, qs) {
  return this._request('DELETE', path, qs);
};

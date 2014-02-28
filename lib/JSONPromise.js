/**
 * Module dependencies.
 */
// Promise Library
var Q = require('q');

// Utility Belt
var _ = require('lodash/dist/lodash.underscore');

/**
 * `JSONPromise` library.
 *
 * Given anything, returns a promise that resolves when the original json is discovered
 * Useful when chaining methods, and methods have object parameters dependencies
 *
 * @api private
 */
function JSONPromise(json) {
  // If an array of json items is passed, just give it to Q
  // Q automatically marks all the promises that are objects as resolved
  if (_.isArray(json)) {
    return Q.all(json);
  }

  // If the json is not an object, already a promise, or null
  // No need to convert it to an promise, just give it back
  if (!json || !_.isObject(json) || Q.isPromise(json)) {
    return json;
  }

  // Convert json objects to promises
  // Resolve the promise when all container promises are resolved
  var nameArr = [],
      promiseArr = [];

  // Create an array
  _.each(json, function(val, name) {
    // Recursively call `JSONPromise` on all
    promiseArr.push(JSONPromise(val));
    nameArr.push(name);
  });

  // Give the arr to Q, and once all promises are resolved
  // create the object back again
  return Q.all(promiseArr).then(function(valueArr) {
    var toReturn = {};

    // Create the object from the resolved promise values
    // Note the order of the array stays the same as passed in
    // Naively copy
    for (var a = 0, l = valueArr.length; a < l; a++) {
      toReturn[nameArr[a]] = valueArr[a];
    }

    // Return the newly minted object
    // This object will not contain any promises
    // All promises will be resolved
    return toReturn;
  });
};

/**
 * Expose `JSONPromise`.
 */
module.exports = JSONPromise;

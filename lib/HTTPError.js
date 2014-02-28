/**
 * Module dependencies.
 */
var util = require('util');

/**
 * `AbstractError` error.
 *
 * @api private
 */
function AbstractError(message, constr) {
  Error.apply(this, arguments);
  Error.captureStackTrace(this, constr || this)

  this.name = 'AbstractError';
  this.message = message;
};

AbstractError.prototype.toString = function() {
  return this.name + ': ' + this.message;
};

/**
 * Inherit from `Error`.
 */
util.inherits(AbstractError, Error);

/**
 * `HTTPError` error.
 *
 * @api private
 */
function HTTPError(message) {
  AbstractError.apply(this, arguments);
  this.name = 'HTTPError';
  this.message = message;
};

/**
 * Inherit from `AbstractError`.
 */
util.inherits(HTTPError, AbstractError);


/**
 * Expose `HTTPError`.
 */
module.exports = HTTPError;

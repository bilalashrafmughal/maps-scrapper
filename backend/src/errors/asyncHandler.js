"use strict";

/**
 * Wraps an async route handler so rejected promises reach the error middleware.
 * Express 5 forwards async errors automatically, but this keeps behaviour
 * explicit and version-independent.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;

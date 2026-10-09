"use strict";

const ApiError = require("./ApiError");

/** 404 handler for unmatched routes. */
function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Central error middleware. Always responds with JSON.
 * Must be registered after all routes.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  // body-parser failures
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error:
        "Payload too large. Reduce the number of locations or split the campaign.",
    });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  const status = err instanceof ApiError ? err.statusCode : 500;

  if (status >= 500) {
    console.error("Unhandled error:", err);
  }

  const body = { error: err?.message || "Internal server error" };
  if (err?.details !== undefined) body.details = err.details;

  res.status(status).json(body);
}

module.exports = { errorHandler, notFoundHandler };

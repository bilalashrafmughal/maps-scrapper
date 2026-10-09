"use strict";

/**
 * Error carrying an HTTP status code. Thrown by services/repositories and
 * translated to a JSON response by the error middleware.
 */
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static payloadTooLarge(message = "Payload too large") {
    return new ApiError(413, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message);
  }
}

module.exports = ApiError;

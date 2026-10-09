"use strict";

const crypto = require("crypto");
const { ApiError } = require("../../../errors");
const {
  CAMPAIGN_DEFAULTS,
  LIMITS,
  CAMPAIGN_STATUS_VALUES,
} = require("../../../config/constants");

/** Clamps a numeric option into its allowed range. */
function clamp(value, { min, max }, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/** Normalises a raw location entry, returning null when it is unusable. */
function normalizeLocation(raw) {
  const location = String(raw?.location ?? "").trim();
  if (!location) return null;
  return {
    location,
    country: raw?.country ? String(raw.country) : null,
    state: raw?.state ? String(raw.state) : null,
    city: raw?.city ? String(raw.city) : null,
  };
}

/** Builds the campaign's human-readable name. */
function buildCampaignName(query) {
  const date = new Date().toLocaleDateString("en-GB");
  return `${query} — ${date} #${crypto.randomInt(1000, 9999)}`;
}

/**
 * Validates and normalises the body of POST /campaigns.
 * @throws {ApiError} 400 when required fields are missing/invalid
 */
function parseCreatePayload(body = {}) {
  const query = String(body.query ?? "").trim();
  if (!query) throw ApiError.badRequest("query is required");

  if (!Array.isArray(body.locations) || body.locations.length === 0) {
    throw ApiError.badRequest("locations[] is required and must not be empty");
  }

  const locations = body.locations.map(normalizeLocation).filter(Boolean);
  if (locations.length === 0) {
    throw ApiError.badRequest("locations[] must contain at least one entry with a location");
  }

  return {
    query,
    locations,
    name: buildCampaignName(query),
    maxResults: clamp(
      body.maxResults,
      LIMITS.maxResults,
      CAMPAIGN_DEFAULTS.maxResults,
    ),
    delayMs: clamp(
      body.delayBetweenRequests,
      LIMITS.delayMs,
      CAMPAIGN_DEFAULTS.delayBetweenRequests,
    ),
    emailConcurrency: clamp(
      body.emailConcurrency,
      LIMITS.emailConcurrency,
      CAMPAIGN_DEFAULTS.emailConcurrency,
    ),
    emailRequired: Boolean(body.emailRequired),
  };
}

/**
 * Validates and normalises the body of PUT /campaigns/:id, falling back to the
 * existing campaign values for any omitted field.
 * @throws {ApiError} 400 on invalid input
 */
function parseUpdatePayload(body = {}, existing) {
  if (!existing) throw ApiError.notFound("Campaign not found");

  const query = String(body.query ?? existing.query ?? "").trim();
  if (!query) throw ApiError.badRequest("query is required");

  let locations;
  if (body.locations !== undefined) {
    if (!Array.isArray(body.locations)) {
      throw ApiError.badRequest("locations must be an array");
    }
    locations = body.locations.map(normalizeLocation).filter(Boolean);
  }

  return {
    query,
    locations,
    maxResults: clamp(
      body.maxResults,
      LIMITS.maxResults,
      existing.max_results,
    ),
    delayMs: clamp(
      body.delayBetweenRequests,
      LIMITS.delayMs,
      existing.delay_ms,
    ),
    emailConcurrency: clamp(
      body.emailConcurrency,
      LIMITS.emailConcurrency,
      existing.email_concurrency,
    ),
    emailRequired:
      body.emailRequired === undefined
        ? Boolean(existing.email_required)
        : Boolean(body.emailRequired),
  };
}

/** Validates a status-change body. @throws {ApiError} */
function parseStatusPayload(body = {}) {
  const status = String(body.status ?? "");
  if (!CAMPAIGN_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest(
      `status must be one of: ${CAMPAIGN_STATUS_VALUES.join(", ")}`,
    );
  }
  return status;
}

module.exports = {
  parseCreatePayload,
  parseUpdatePayload,
  parseStatusPayload,
  normalizeLocation,
  buildCampaignName,
};

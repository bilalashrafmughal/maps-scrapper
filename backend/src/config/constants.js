"use strict";

/** Campaign lifecycle states (must match the MySQL ENUM). */
const CAMPAIGN_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
});

/** Per-location scraping states (must match the MySQL ENUM). */
const LOCATION_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
});

const CAMPAIGN_STATUS_VALUES = Object.values(CAMPAIGN_STATUS);

/** Statuses that mean "work is still outstanding". */
const UNFINISHED_CAMPAIGN_STATUSES = [
  CAMPAIGN_STATUS.PENDING,
  CAMPAIGN_STATUS.RUNNING,
];

/** Defaults applied when a request omits campaign options. */
const CAMPAIGN_DEFAULTS = Object.freeze({
  maxResults: 300,
  delayBetweenRequests: 1000,
  emailConcurrency: 3,
  emailRequired: false,
});

/** Guards for scraping options. */
const LIMITS = Object.freeze({
  maxResults: { min: 5, max: 500 },
  delayMs: { min: 200, max: 5000 },
  emailConcurrency: { min: 1, max: 10 },
});

module.exports = {
  CAMPAIGN_STATUS,
  LOCATION_STATUS,
  CAMPAIGN_STATUS_VALUES,
  UNFINISHED_CAMPAIGN_STATUSES,
  CAMPAIGN_DEFAULTS,
  LIMITS,
};

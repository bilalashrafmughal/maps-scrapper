"use strict";

/**
 * Map Scraper module — Google Maps business scraping campaigns.
 *
 * Exposes:
 *   - router    : Express router mounted at /api/map-scraper
 *   - service   : business logic layer
 *   - scheduler : background campaign scheduler (start/stop)
 */
const router = require("./mapScraper.routes");
const service = require("./mapScraper.service");
const scheduler = require("./scraper/campaignScheduler");

module.exports = {
  router,
  service,
  scheduler,
};

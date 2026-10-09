"use strict";

const express = require("express");
const cors = require("cors");

const config = require("./config/env");
const { errorHandler, notFoundHandler } = require("./errors");
const mapScraper = require("./modules/map-scraper");
const apiIndexPage = require("./views/apiIndexPage");

/**
 * Builds and returns the configured Express application.
 * Keeps bootstrap (server start, DB init) out of the app definition.
 */
function createApp() {
  const app = express();

  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.jsonBodyLimit }));
  app.use(cors("*"));

  // ── API ───────────────────────────────────────────────────────────────────
  app.use("/api/map-scraper", mapScraper.router);

  // Backwards-compatible alias: the original API lived at /api/*.
  // Mounted last so it never shadows the namespaced routes.
  app.use("/api", mapScraper.router);

  // ── Root landing page ─────────────────────────────────────────────────────
  app.get("/", (_req, res) => res.type("html").send(apiIndexPage));

  // ── Fallbacks ─────────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

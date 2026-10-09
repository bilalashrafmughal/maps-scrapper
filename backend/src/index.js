"use strict";

const config = require("./config/env");
const { createApp } = require("./app");
const { getDb, closeDb } = require("./db");
const mapScraper = require("./modules/map-scraper");

/**
 * Boots the API: initialises the database, mounts the app, then starts the
 * background scheduler that dispatches pending campaigns every minute.
 */
async function main() {
  await getDb();
  console.log("✅ Database initialized");

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`\n============================================`);
    console.log(`  Google Maps Scraper API`);
    console.log(`  Server:    http://localhost:${config.port}`);
    console.log(`  Dashboard: http://localhost:${config.port}/`);
    console.log(`  Module:    /api/map-scraper`);
    console.log(`============================================\n`);
  });

  // Background scheduler — picks up pending campaigns and dispatches workers.
  // Runs immediately, then every SCHEDULER_INTERVAL_MS.
  mapScraper.scheduler.start();
  mapScraper.scheduler.runTick().catch(() => {});

  registerShutdown(server);
}

/** Closes the HTTP server, scheduler and DB pool on SIGINT/SIGTERM. */
function registerShutdown(server) {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down...`);
    mapScraper.scheduler.stop();
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
    // Force-exit if graceful close hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

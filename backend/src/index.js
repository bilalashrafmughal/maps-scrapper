"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const routes = require("./routes");
const db = require("./database");
const { runCampaignWorker } = require("./worker");

const PORT = process.env.PORT || 8080;

/**
 * Resume any pending/running campaigns from a previous session.
 */
async function resumePendingCampaigns() {
  const pending = await db.getPendingCampaigns();
  if (pending.length === 0) return;
  console.log(`\n🔄 Resuming ${pending.length} unfinished campaign(s)...`);
  for (const campaign of pending) {
    console.log(
      `  - Campaign #${campaign.id}: "${campaign.query}" (${campaign.status})`,
    );
    runCampaignWorker(campaign.id, campaign).catch((err) => {
      console.error(`Worker crash for campaign #${campaign.id}:`, err.message);
    });
  }
}

async function main() {
  // Initialize the database (creates tables on first run)
  await db.getDb();
  console.log("✅ Database initialized");

  const app = express();
  app.use(express.json());
  app.use(cors("*"));
  // ── API routes ──────────────────────────────────────────────────────────
  app.use("/api", routes);

  // ── Serve a simple HTML dashboard at root ────────────────────────────────
  app.get("/", (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google Maps Scraper API</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 640px; width: 90%; }
          h1 { font-size: 1.6rem; margin-bottom: 6px; }
          p { color: #666; margin-bottom: 24px; }
          .endpoints { list-style: none; }
          .endpoints li { display: flex; align-items: baseline; padding: 10px 0; border-bottom: 1px solid #eee; }
          .endpoints li:last-child { border: none; }
          .method { display: inline-block; font-size: .7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; color: #fff; margin-right: 12px; min-width: 48px; text-align: center; }
          .get { background: #2e7d32; }
          .post { background: #1565c0; }
          code { font-size: .85rem; color: #444; }
          .badge { margin-left: auto; font-size: .75rem; color: #999; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>📍 Google Maps Scraper API</h1>
          <p>The server is running. Use the endpoints below to create and monitor scraping campaigns.</p>
          <ul class="endpoints">
            <li><span class="method get">GET</span> <code>/api/health</code><span class="badge">Health check</span></li>
            <li><span class="method get">GET</span> <code>/api/stats</code><span class="badge">DB stats</span></li>
            <li><span class="method post">POST</span> <code>/api/campaigns</code><span class="badge">Start a new campaign</span></li>
            <li><span class="method get">GET</span> <code>/api/campaigns</code><span class="badge">List campaigns</span></li>
            <li><span class="method get">GET</span> <code>/api/campaigns/:id</code><span class="badge">Campaign detail + progress</span></li>
            <li><span class="method get">GET</span> <code>/api/campaigns/:id/progress</code><span class="badge">Progress only</span></li>
            <li><span class="method get">GET</span> <code>/api/campaigns/:id/results</code><span class="badge">Scraped data</span></li>
            <li><span class="method get">GET</span> <code>/api/campaigns/:id/locations</code><span class="badge">Location statuses</span></li>
          </ul>
        </div>
      </body>
      </html>
    `);
  });

  app.listen(PORT, () => {
    console.log(`\n============================================`);
    console.log(`  Google Maps Scraper API`);
    console.log(`  Server: http://localhost:${PORT}`);
    console.log(`  Dashboard: http://localhost:${PORT}/`);
    console.log(`============================================\n`);
  });

  // Resume any campaigns that were interrupted when the server went down
  resumePendingCampaigns();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

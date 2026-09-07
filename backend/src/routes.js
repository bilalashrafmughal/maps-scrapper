"use strict";

const express = require("express");
const crypto = require("crypto");

const db = require("./database");
const { runCampaignWorker } = require("./worker");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Health / Stats
// ─────────────────────────────────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/stats", async (_req, res) => {
  res.json(await db.getStats());
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/campaigns
 * Body:
 * {
 *   "query": "plumbers",
 *   "locations": [
 *     { "location": "London, UK", "country": "UK", "state": "England", "city": "London" },
 *     { "location": "Manchester, UK", ... }
 *   ],
 *   "maxResults": 100,
 *   "delayBetweenRequests": 1000,
 *   "emailConcurrency": 3,
 *   "emailRequired": true
 * }
 */
router.post("/campaigns", async (req, res) => {
  try {
    const {
      query,
      locations,
      maxResults = 300,
      delayBetweenRequests = 1000,
      emailConcurrency = 3,
      emailRequired = false,
    } = req.body;

    if (
      !query ||
      !locations ||
      !Array.isArray(locations) ||
      locations.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "query and locations[] are required" });
    }

    // Generate a readable name from query + timestamp
    const name = `${query} — ${new Date().toLocaleDateString("en-GB")} #${crypto.randomInt(1000, 9999)}`;

    const campaignId = await db.createCampaign({
      name,
      query,
      maxResults,
      delayMs: delayBetweenRequests,
      emailConcurrency,
      emailRequired,
      locations,
    });

    // Fire-and-forget worker (non-blocking)
    const campaign = await db.getCampaign(campaignId);
    runCampaignWorker(campaignId, campaign).catch(async (err) => {
      console.error(`Worker crash for campaign #${campaignId}:`, err.message);
      await db.updateCampaignStatus(campaignId, "failed");
    });

    res.status(201).json({
      id: campaignId,
      name,
      status: "pending",
      message: `Campaign created with ${locations.length} location(s)`,
    });
  } catch (err) {
    console.error("POST /campaigns error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/campaigns — list all campaigns
 */
router.get("/campaigns", async (_req, res) => {
  res.json(await db.listCampaigns());
});

/**
 * GET /api/campaigns/:id — single campaign with progress
 */
router.get("/campaigns/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const campaign = await db.getCampaign(id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const progress = await db.getCampaignProgress(id);
  const locations = await db.getCampaignLocations(id);

  res.json({ ...campaign, progress, locations });
});

/**
 * GET /api/campaigns/:id/progress — progress summary only
 */
router.get("/campaigns/:id/progress", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const campaign = await db.getCampaign(id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  res.json({
    campaignId: id,
    ...(await db.getCampaignProgress(id)),
  });
});

/**
 * GET /api/campaigns/:id/results — all scraped businesses for a campaign
 */
router.get("/campaigns/:id/results", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const campaign = await db.getCampaign(id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  res.json(await db.getCampaignResults(id));
});

/**
 * GET /api/campaigns/:id/locations — locations with their individual status
 */
router.get("/campaigns/:id/locations", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const campaign = await db.getCampaign(id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  res.json(await db.getCampaignLocations(id));
});

module.exports = router;

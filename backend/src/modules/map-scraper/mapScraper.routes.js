"use strict";

const express = require("express");
const controller = require("./mapScraper.controller");
const { asyncHandler } = require("../../errors");

const router = express.Router();

// ── Health / Stats ──────────────────────────────────────────────────────────
router.get("/health", controller.health);
router.get("/stats", asyncHandler(controller.getStats));

// ── Campaigns ───────────────────────────────────────────────────────────────
router
  .route("/campaigns")
  .get(asyncHandler(controller.listCampaigns))
  .post(asyncHandler(controller.createCampaign));

router
  .route("/campaigns/:id")
  .get(asyncHandler(controller.getCampaign))
  .put(asyncHandler(controller.updateCampaign))
  .delete(asyncHandler(controller.deleteCampaign));

router.get("/campaigns/:id/progress", asyncHandler(controller.getProgress));
router.get("/campaigns/:id/results", asyncHandler(controller.getResults));
router.get("/campaigns/:id/locations", asyncHandler(controller.getLocations));
router.get("/campaigns/:id/export", asyncHandler(controller.exportCampaign));

router.patch("/campaigns/:id/status", asyncHandler(controller.updateStatus));
router.post("/campaigns/:id/start", asyncHandler(controller.startCampaign));
router.post(
  "/campaigns/:id/retry-failed",
  asyncHandler(controller.retryFailed),
);

module.exports = router;

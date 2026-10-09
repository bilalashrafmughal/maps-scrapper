"use strict";

const service = require("./mapScraper.service");
const { exportToExcel } = require("./scraper/excelExporter");
const { ApiError } = require("../../errors");

/** GET /health */
function health(_req, res) {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
}

/** GET /stats */
async function getStats(_req, res) {
  res.json(await service.getStats());
}

/** POST /campaigns */
async function createCampaign(req, res) {
  res.status(201).json(await service.createCampaign(req.body));
}

/** GET /campaigns */
async function listCampaigns(_req, res) {
  res.json(await service.listCampaigns());
}

/** GET /campaigns/:id */
async function getCampaign(req, res) {
  res.json(await service.getCampaignDetail(parseId(req)));
}

/** GET /campaigns/:id/progress */
async function getProgress(req, res) {
  res.json(await service.getProgress(parseId(req)));
}

/** GET /campaigns/:id/results */
async function getResults(req, res) {
  res.json(await service.getResults(parseId(req)));
}

/** GET /campaigns/:id/locations */
async function getLocations(req, res) {
  res.json(await service.getLocations(parseId(req)));
}

/** PUT /campaigns/:id */
async function updateCampaign(req, res) {
  res.json(await service.updateCampaign(parseId(req), req.body));
}

/** PATCH /campaigns/:id/status */
async function updateStatus(req, res) {
  res.json(await service.changeStatus(parseId(req), req.body));
}

/** POST /campaigns/:id/start */
async function startCampaign(req, res) {
  res.json(await service.startCampaign(parseId(req)));
}

/** DELETE /campaigns/:id */
async function deleteCampaign(req, res) {
  res.json(await service.deleteCampaign(parseId(req)));
}

/** POST /campaigns/:id/retry-failed — re-queue timeout/DNS failures */
async function retryFailed(req, res) {
  res.json(await service.retryFailedLocations(parseId(req)));
}

/** GET /campaigns/:id/export — streams an Excel workbook of the results. */
async function exportCampaign(req, res) {
  const id = parseId(req);
  const results = await service.getResults(id);
  if (results.length === 0) {
    throw ApiError.badRequest("No results to export for this campaign");
  }

  const campaign = await service.getCampaignDetail(id);
  const safeName = (campaign.query || "campaign")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);

  const buffer = await exportToExcel(results, `${safeName}_campaign_${id}.xlsx`);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}_campaign_${id}.xlsx"`,
  );
  res.send(buffer);
}

function parseId(req) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest("Invalid campaign id");
  }
  return id;
}

module.exports = {
  health,
  getStats,
  createCampaign,
  listCampaigns,
  getCampaign,
  getProgress,
  getResults,
  getLocations,
  updateCampaign,
  updateStatus,
  startCampaign,
  deleteCampaign,
  retryFailed,
  exportCampaign,
};

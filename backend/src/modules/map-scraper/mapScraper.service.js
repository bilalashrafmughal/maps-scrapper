"use strict";

const { ApiError } = require("../../errors");
const {
  CAMPAIGN_STATUS,
  UNFINISHED_CAMPAIGN_STATUSES,
} = require("../../config/constants");

const campaignRepo = require("./repositories/campaign.repository");
const locationRepo = require("./repositories/location.repository");
const businessRepo = require("./repositories/business.repository");
const statsRepo = require("./repositories/stats.repository");
const {
  parseCreatePayload,
  parseUpdatePayload,
  parseStatusPayload,
} = require("./dto/campaign.dto");
const {
  runCampaignWorker,
  requestPause,
  requestStop,
  isActive,
} = require("./scraper/campaignWorker");

// ── Stats ───────────────────────────────────────────────────────────────────

const getStats = () => statsRepo.getTotals();

// ── Campaigns ───────────────────────────────────────────────────────────────

/** Creates a campaign and starts its worker. */
async function createCampaign(body) {
  const payload = parseCreatePayload(body);

  const id = await campaignRepo.insert(payload);
  await locationRepo.insertMany(id, payload.locations);

  const campaign = await campaignRepo.findById(id);
  startWorker(id, campaign);

  return {
    id,
    name: payload.name,
    status: CAMPAIGN_STATUS.PENDING,
    message: `Campaign created with ${payload.locations.length} location(s)`,
  };
}

const listCampaigns = () => campaignRepo.findAll();

/** Campaign detail with progress summary and locations. */
async function getCampaignDetail(id) {
  const campaign = await campaignRepo.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");

  const [progress, locations] = await Promise.all([
    getProgress(id),
    locationRepo.findByCampaign(id),
  ]);

  return { ...campaign, progress, locations };
}

/** Progress summary only. */
async function getProgress(id) {
  const campaign = await campaignRepo.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");

  const breakdown = await statsRepo.getCampaignBreakdown(id);
  return { campaignId: id, ...breakdown, status: campaign.status };
}

async function getResults(id) {
  await assertExists(id);
  return businessRepo.findByCampaign(id);
}

async function getLocations(id) {
  await assertExists(id);
  return locationRepo.findByCampaign(id);
}

/**
 * Updates campaign options and appends any new locations.
 * Existing locations are preserved (append-only).
 */
async function updateCampaign(id, body) {
  const existing = await campaignRepo.findById(id);
  const payload = parseUpdatePayload(body, existing);

  await campaignRepo.updateOptions(id, payload);

  if (Array.isArray(payload.locations) && payload.locations.length > 0) {
    const existingNames = new Set(
      await locationRepo.findNamesByCampaign(id),
    );
    const toInsert = payload.locations.filter(
      (l) => !existingNames.has(l.location),
    );
    await locationRepo.insertMany(id, toInsert);
  }

  const campaign = await campaignRepo.findById(id);
  return { ...campaign, message: "Campaign updated" };
}

/** Changes campaign status; pauses/stops the worker where applicable. */
async function changeStatus(id, body) {
  const status = parseStatusPayload(body);
  const existing = await campaignRepo.findById(id);
  if (!existing) throw ApiError.notFound("Campaign not found");

  await campaignRepo.updateStatus(id, status);

  if (status === CAMPAIGN_STATUS.PAUSED) requestPause(id);
  if (status === CAMPAIGN_STATUS.FAILED || status === CAMPAIGN_STATUS.COMPLETED) {
    requestStop(id);
  }

  return { id, status, message: "Status updated" };
}

/** Explicitly (re)starts a campaign's worker. */
async function startCampaign(id) {
  const campaign = await campaignRepo.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");

  if (isActive(id)) {
    return { id, status: campaign.status, message: "Campaign already running" };
  }

  await campaignRepo.updateStatus(id, CAMPAIGN_STATUS.RUNNING);
  startWorker(id, campaign);

  return { id, status: CAMPAIGN_STATUS.RUNNING, message: "Campaign started" };
}

/** Deletes a campaign (cascade removes its locations and businesses). */
async function deleteCampaign(id) {
  const removed = await campaignRepo.remove(id);
  if (!removed) throw ApiError.notFound("Campaign not found");
  requestStop(id);
  return { id, message: "Campaign deleted" };
}

/**
 * Re-queues locations that failed for retryable, network-level reasons
 * (timeouts / unresolvable hostnames) and restarts the campaign.
 *
 * Locations that failed for other reasons are left untouched so a permanently
 * broken entry is not retried in a loop.
 */
async function retryFailedLocations(id) {
  const campaign = await campaignRepo.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");

  const reset = await locationRepo.resetRetryableFailures(id);

  if (reset === 0) {
    return {
      id,
      reset: 0,
      status: campaign.status,
      message: "No retryable failed locations found",
    };
  }

  // Re-queue the campaign so the scheduler (or the worker below) picks it up.
  await campaignRepo.updateStatus(id, CAMPAIGN_STATUS.PENDING);

  const fresh = await campaignRepo.findById(id);

  // Kick the worker immediately when it is not already running; otherwise the
  // running worker will naturally pick up the newly-pending locations.
  let started = false;
  if (!isActive(id)) {
    startWorker(id, fresh);
    started = true;
  }

  return {
    id,
    reset,
    status: CAMPAIGN_STATUS.PENDING,
    started,
    message: `Reset ${reset} location(s) for retry`,
  };
}

// ── Internals ───────────────────────────────────────────────────────────────

async function assertExists(id) {
  const campaign = await campaignRepo.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  return campaign;
}

/**
 * Launches the worker without blocking the request, marking the campaign failed
 * if the worker itself crashes.
 */
function startWorker(id, campaign) {
  runCampaignWorker(id, campaign).catch(async (err) => {
    console.error(`Worker crash for campaign #${id}:`, err.message);
    await campaignRepo.updateStatus(id, CAMPAIGN_STATUS.FAILED);
  });
}

module.exports = {
  getStats,
  createCampaign,
  listCampaigns,
  getCampaignDetail,
  getProgress,
  getResults,
  getLocations,
  updateCampaign,
  changeStatus,
  startCampaign,
  deleteCampaign,
  retryFailedLocations,
  UNFINISHED_CAMPAIGN_STATUSES,
};

"use strict";

const { getPool } = require("../../../db");

/** High-level counters for the dashboard. */
async function getTotals() {
  const [[{ campaigns }]] = await getPool().execute(
    `SELECT COUNT(*) as campaigns FROM campaigns`,
  );
  const [[{ businesses }]] = await getPool().execute(
    `SELECT COUNT(*) as businesses FROM businesses`,
  );
  const [[{ locations }]] = await getPool().execute(
    `SELECT COUNT(*) as locations FROM campaign_locations`,
  );
  return { campaigns, businesses, locations };
}

/** Per-campaign counter breakdown used by the progress endpoint. */
async function getCampaignBreakdown(campaignId) {
  const [[{ total }]] = await getPool().execute(
    `SELECT COUNT(*) as total FROM campaign_locations WHERE campaign_id = ?`,
    [campaignId],
  );
  const [[{ completed }]] = await getPool().execute(
    `SELECT COUNT(*) as completed FROM campaign_locations
      WHERE campaign_id = ? AND status = 'completed'`,
    [campaignId],
  );
  const [[{ failed }]] = await getPool().execute(
    `SELECT COUNT(*) as failed FROM campaign_locations
      WHERE campaign_id = ? AND status = 'failed'`,
    [campaignId],
  );
  const [[{ businesses }]] = await getPool().execute(
    `SELECT COUNT(*) as businesses FROM businesses WHERE campaign_id = ?`,
    [campaignId],
  );

  return {
    total,
    completed,
    failed,
    pending: total - completed - failed,
    businesses,
  };
}

module.exports = { getTotals, getCampaignBreakdown };

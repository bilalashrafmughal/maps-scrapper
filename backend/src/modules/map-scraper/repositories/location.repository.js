"use strict";

const { getPool } = require("../../../db");

const CHUNK_SIZE = 500;

/**
 * Bulk-inserts locations for a campaign in bounded chunks, deduping by the
 * `location` string. Batching avoids exceeding MySQL's `max_allowed_packet`.
 *
 * @returns {Promise<number>} number of rows inserted
 */
async function insertMany(campaignId, locations, chunkSize = CHUNK_SIZE) {
  if (!Array.isArray(locations) || locations.length === 0) return 0;

  const seen = new Set();
  const rows = [];
  for (const loc of locations) {
    const name = (loc?.location ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    rows.push([
      campaignId,
      name,
      loc.country || null,
      loc.state || null,
      loc.city || null,
    ]);
  }

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    await getPool().execute(
      `INSERT INTO campaign_locations (campaign_id, location, country, state, city)
       VALUES ${placeholders}`,
      chunk.flat(),
    );
  }

  return rows.length;
}

async function findByCampaign(campaignId) {
  const [rows] = await getPool().execute(
    `SELECT * FROM campaign_locations WHERE campaign_id = ? ORDER BY id ASC`,
    [campaignId],
  );
  return rows;
}

/** Locations still awaiting work, oldest first. */
async function findPending(campaignId) {
  const [rows] = await getPool().execute(
    `SELECT * FROM campaign_locations
      WHERE campaign_id = ? AND status = 'pending' ORDER BY id ASC`,
    [campaignId],
  );
  return rows;
}

/** Distinct location strings already stored for a campaign. */
async function findNamesByCampaign(campaignId) {
  const [rows] = await getPool().execute(
    `SELECT location FROM campaign_locations WHERE campaign_id = ?`,
    [campaignId],
  );
  return rows.map((r) => r.location);
}

async function updateStatus(id, status, { itemsScraped, errorMsg } = {}) {
  const sets = ["status = ?"];
  const params = [status];

  if (status === "running") {
    sets.push("started_at = NOW()");
  } else if (status === "completed" || status === "failed") {
    sets.push("completed_at = NOW()");
  }
  if (itemsScraped !== undefined) {
    sets.push("items_scraped = ?");
    params.push(itemsScraped);
  }
  if (errorMsg !== undefined) {
    sets.push("error_msg = ?");
    params.push(errorMsg);
  }

  params.push(id);
  await getPool().execute(
    `UPDATE campaign_locations SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );
}

async function removeByCampaign(campaignId) {
  await getPool().execute(
    `DELETE FROM campaign_locations WHERE campaign_id = ?`,
    [campaignId],
  );
}

/** Error fragments that mean "retryable" (transient network failures). */
const RETRYABLE_ERROR_PATTERNS = ["timeout", "ERR_NAME_NOT_RESOLVED"];

/**
 * Resets retryable failed locations back to `pending`.
 *
 * Only locations whose `error_msg` contains one of the retryable fragments are
 * touched — genuine failures (bad query, parse errors) are left alone so they
 * are not retried in a loop. `error_msg` is cleared so the next run starts clean.
 *
 * @param {number} campaignId
 * @returns {Promise<number>} number of locations reset
 */
async function resetRetryableFailures(campaignId) {
  const clauses = RETRYABLE_ERROR_PATTERNS.map(() => "error_msg LIKE ?").join(
    " OR ",
  );
  const params = [
    campaignId,
    ...RETRYABLE_ERROR_PATTERNS.map((p) => `%${p}%`),
  ];

  const [result] = await getPool().execute(
    `UPDATE campaign_locations
        SET status = 'pending',
            error_msg = NULL,
            started_at = NULL,
            completed_at = NULL
      WHERE campaign_id = ?
        AND status = 'failed'
        AND error_msg IS NOT NULL
        AND (${clauses})`,
    params,
  );

  return result.affectedRows;
}

module.exports = {
  insertMany,
  findByCampaign,
  findPending,
  findNamesByCampaign,
  updateStatus,
  removeByCampaign,
  resetRetryableFailures,
  RETRYABLE_ERROR_PATTERNS,
};

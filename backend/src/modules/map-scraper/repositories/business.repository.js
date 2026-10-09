"use strict";

const { getPool } = require("../../../db");

const COLUMNS = `(campaign_id, location_id, name, rating, reviews, category, address, phone, website, email, maps_url)`;
const PLACEHOLDER = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

/** Normalises a business object (camelCase in, DB-ready tuple out). */
function toRow(b) {
  return [
    b.campaignId,
    b.locationId,
    b.name || "",
    b.rating ? parseFloat(b.rating) : null,
    b.reviews != null && b.reviews !== "" ? parseInt(b.reviews, 10) : null,
    b.category || "",
    b.address || "",
    b.phone || "",
    b.website || "",
    b.email || "",
    b.mapsUrl || "",
  ];
}

async function insertOne(business) {
  await getPool().execute(
    `INSERT INTO businesses ${COLUMNS} VALUES ${PLACEHOLDER}`,
    toRow(business),
  );
}

/** Batch insert; chunked to stay within packet limits for large result sets. */
async function insertMany(rows, chunkSize = 200) {
  if (!rows.length) return 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => PLACEHOLDER).join(", ");
    await getPool().execute(
      `INSERT INTO businesses ${COLUMNS} VALUES ${placeholders}`,
      chunk.flatMap(toRow),
    );
  }

  return rows.length;
}

async function findByCampaign(campaignId) {
  const [rows] = await getPool().execute(
    `SELECT * FROM businesses WHERE campaign_id = ? ORDER BY location_id, id`,
    [campaignId],
  );
  return rows;
}

async function countByCampaign(campaignId) {
  const [[{ count }]] = await getPool().execute(
    `SELECT COUNT(*) as count FROM businesses WHERE campaign_id = ?`,
    [campaignId],
  );
  return count;
}

module.exports = { insertOne, insertMany, findByCampaign, countByCampaign };

"use strict";

const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

// Load .env file manually if present (since we don't have dotenv package)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;

// Parse DATABASE_URL and strip invalid query params for mysql2
let DB_CONFIG;
if (DATABASE_URL) {
  // Remove query params that mysql2 doesn't accept
  const cleanUrl = DATABASE_URL.replace(
    /\?(connection_limit|socket_timeout|connect_timeout)=[^&]+&?/g,
    "",
  ).replace(/[?&]$/, "");
  DB_CONFIG = { uri: cleanUrl };
} else {
  DB_CONFIG = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "leads",
  };
}

let pool = null;

/**
 * Initializes the connection pool and creates tables if they don't exist.
 */
async function getDb() {
  if (pool) return pool;

  pool = mysql.createPool({
    ...DB_CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  await createTables();
  console.log("✅ MySQL connected — database 'leads' ready");
  return pool;
}

async function createTables() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      name             VARCHAR(255) NOT NULL,
      query            VARCHAR(500) NOT NULL,
      max_results      INT NOT NULL DEFAULT 50,
      delay_ms         INT NOT NULL DEFAULT 1000,
      email_concurrency INT NOT NULL DEFAULT 3,
      email_required   TINYINT(1) NOT NULL DEFAULT 0,
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      status           ENUM('pending','running','paused','completed','failed') NOT NULL DEFAULT 'pending'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS campaign_locations (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id      INT NOT NULL,
      location         VARCHAR(500) NOT NULL,
      country          VARCHAR(255) DEFAULT NULL,
      state            VARCHAR(255) DEFAULT NULL,
      city             VARCHAR(255) DEFAULT NULL,
      status           ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
      started_at       DATETIME DEFAULT NULL,
      completed_at     DATETIME DEFAULT NULL,
      items_scraped    INT NOT NULL DEFAULT 0,
      error_msg        TEXT DEFAULT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id      INT NOT NULL,
      location_id      INT NOT NULL,
      name             VARCHAR(500) DEFAULT '',
      rating           DECIMAL(3,1) DEFAULT NULL,
      reviews          INT DEFAULT NULL,
      category         VARCHAR(255) DEFAULT '',
      address          TEXT DEFAULT NULL,
      phone            VARCHAR(100) DEFAULT '',
      website          VARCHAR(500) DEFAULT '',
      email            VARCHAR(255) DEFAULT '',
      maps_url         VARCHAR(1000) DEFAULT '',
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES campaign_locations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // MySQL doesn't support CREATE INDEX IF NOT EXISTS — use a procedure instead
  await ensureIndex("idx_biz_campaign", "businesses", "campaign_id");
  await ensureIndex("idx_biz_location", "businesses", "location_id");
  await ensureIndex("idx_loc_campaign", "campaign_locations", "campaign_id");
}

/** Create an index only if it doesn't already exist. */
async function ensureIndex(indexName, table, column) {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName],
  );
  if (count === 0) {
    await pool.execute(
      `CREATE INDEX \`${indexName}\` ON \`${table}\` (\`${column}\`)`,
    );
  }
}

/**
 * Save changes to disk — no-op for MySQL (auto-committed).
 */
function save() {} // MySQL auto-commits via pool.execute

// ── Campaign CRUD ──────────────────────────────────────────────────────────

async function createCampaign({
  name,
  query,
  maxResults,
  delayMs,
  emailConcurrency,
  emailRequired,
  locations,
}) {
  const [result] = await pool.execute(
    `INSERT INTO campaigns (name, query, max_results, delay_ms, email_concurrency, email_required)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, query, maxResults, delayMs, emailConcurrency, emailRequired ? 1 : 0],
  );
  const campaignId = result.insertId;

  if (locations && locations.length > 0) {
    const values = locations.map((loc) => [
      campaignId,
      loc.location,
      loc.country || null,
      loc.state || null,
      loc.city || null,
    ]);
    const placeholders = values.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const flat = values.flat();
    await pool.execute(
      `INSERT INTO campaign_locations (campaign_id, location, country, state, city) VALUES ${placeholders}`,
      flat,
    );
  }

  return campaignId;
}

async function getCampaign(id) {
  const [rows] = await pool.execute(`SELECT * FROM campaigns WHERE id = ?`, [
    id,
  ]);
  return rows.length ? rows[0] : null;
}

async function listCampaigns() {
  const [rows] = await pool.execute(
    `SELECT * FROM campaigns ORDER BY created_at DESC`,
  );
  return rows;
}

async function updateCampaignStatus(id, status) {
  await pool.execute(`UPDATE campaigns SET status = ? WHERE id = ?`, [
    status,
    id,
  ]);
}

/**
 * Returns all campaigns that are pending or running (unfinished).
 * Used on server startup to resume interrupted campaigns.
 */
async function getPendingCampaigns() {
  const [rows] = await pool.execute(
    `SELECT * FROM campaigns WHERE status IN ('pending','running') ORDER BY created_at ASC`,
  );
  return rows;
}

async function getPendingLocations(campaignId) {
  const [rows] = await pool.execute(
    `SELECT * FROM campaign_locations WHERE campaign_id = ? AND status = 'pending' ORDER BY id ASC`,
    [campaignId],
  );
  return rows;
}

async function getRunningCampaigns() {
  const [rows] = await pool.execute(
    `SELECT * FROM campaigns WHERE status IN ('running','pending') ORDER BY created_at ASC`,
  );
  return rows;
}

async function updateLocationStatus(
  id,
  status,
  { itemsScraped, errorMsg } = {},
) {
  const sets = [`status = ?`];
  const params = [status];

  if (status === "running") {
    sets.push(`started_at = NOW()`);
  } else if (status === "completed" || status === "failed") {
    sets.push(`completed_at = NOW()`);
  }
  if (itemsScraped !== undefined) {
    sets.push(`items_scraped = ?`);
    params.push(itemsScraped);
  }
  if (errorMsg !== undefined) {
    sets.push(`error_msg = ?`);
    params.push(errorMsg);
  }
  params.push(id);
  await pool.execute(
    `UPDATE campaign_locations SET ${sets.join(", ")} WHERE id = ?`,
    params,
  );
}

async function insertBusiness(business) {
  await pool.execute(
    `INSERT INTO businesses (campaign_id, location_id, name, rating, reviews, category, address, phone, website, email, maps_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      business.campaignId,
      business.locationId,
      business.name || "",
      business.rating ? parseFloat(business.rating) : null,
      business.reviews != null && business.reviews !== ""
        ? parseInt(business.reviews, 10)
        : null,
      business.category || "",
      business.address || "",
      business.phone || "",
      business.website || "",
      business.email || "",
      business.mapsUrl || "",
    ],
  );
}

async function saveBusinesses(rows) {
  if (!rows.length) return;
  const placeholders = rows
    .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .join(", ");
  const flat = rows
    .map((b) => [
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
    ])
    .flat();
  await pool.execute(
    `INSERT INTO businesses (campaign_id, location_id, name, rating, reviews, category, address, phone, website, email, maps_url)
     VALUES ${placeholders}`,
    flat,
  );
}

async function getCampaignResults(campaignId) {
  const [rows] = await pool.execute(
    `SELECT * FROM businesses WHERE campaign_id = ? ORDER BY location_id, id`,
    [campaignId],
  );
  return rows;
}

async function getCampaignLocations(campaignId) {
  const [rows] = await pool.execute(
    `SELECT * FROM campaign_locations WHERE campaign_id = ? ORDER BY id ASC`,
    [campaignId],
  );
  return rows;
}

async function getCampaignProgress(campaignId) {
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) as total FROM campaign_locations WHERE campaign_id = ?`,
    [campaignId],
  );
  const [[{ completed }]] = await pool.execute(
    `SELECT COUNT(*) as completed FROM campaign_locations WHERE campaign_id = ? AND status = 'completed'`,
    [campaignId],
  );
  const [[{ failed }]] = await pool.execute(
    `SELECT COUNT(*) as failed FROM campaign_locations WHERE campaign_id = ? AND status = 'failed'`,
    [campaignId],
  );
  const [[{ businesses }]] = await pool.execute(
    `SELECT COUNT(*) as businesses FROM businesses WHERE campaign_id = ?`,
    [campaignId],
  );

  const campaign = await getCampaign(campaignId);

  return {
    total,
    completed,
    failed,
    pending: total - completed - failed,
    businesses,
    status: campaign?.status || "unknown",
  };
}

async function getStats() {
  const [[{ campaigns }]] = await pool.execute(
    `SELECT COUNT(*) as campaigns FROM campaigns`,
  );
  const [[{ businesses }]] = await pool.execute(
    `SELECT COUNT(*) as businesses FROM businesses`,
  );
  const [[{ locations }]] = await pool.execute(
    `SELECT COUNT(*) as locations FROM campaign_locations`,
  );
  return { campaigns, businesses, locations };
}

module.exports = {
  getDb,
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
  getPendingCampaigns,
  getPendingLocations,
  getRunningCampaigns,
  updateLocationStatus,
  insertBusiness,
  saveBusinesses,
  getCampaignResults,
  getCampaignLocations,
  getCampaignProgress,
  getStats,
};

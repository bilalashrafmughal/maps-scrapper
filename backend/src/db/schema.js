"use strict";

/**
 * Creates all tables and indexes if they do not already exist.
 * Idempotent — safe to run on every boot.
 *
 * @param {import('mysql2/promise').Pool} pool
 */
async function createSchema(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      query             VARCHAR(500) NOT NULL,
      max_results       INT NOT NULL DEFAULT 50,
      delay_ms          INT NOT NULL DEFAULT 1000,
      email_concurrency INT NOT NULL DEFAULT 3,
      email_required    TINYINT(1) NOT NULL DEFAULT 0,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      status            ENUM('pending','running','paused','completed','failed') NOT NULL DEFAULT 'pending'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS campaign_locations (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id   INT NOT NULL,
      location      VARCHAR(500) NOT NULL,
      country       VARCHAR(255) DEFAULT NULL,
      state         VARCHAR(255) DEFAULT NULL,
      city          VARCHAR(255) DEFAULT NULL,
      status        ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
      started_at    DATETIME DEFAULT NULL,
      completed_at  DATETIME DEFAULT NULL,
      items_scraped INT NOT NULL DEFAULT 0,
      error_msg     TEXT DEFAULT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS businesses (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT NOT NULL,
      location_id INT NOT NULL,
      name        VARCHAR(500) DEFAULT '',
      rating      DECIMAL(3,1) DEFAULT NULL,
      reviews     INT DEFAULT NULL,
      category    VARCHAR(255) DEFAULT '',
      address     TEXT DEFAULT NULL,
      phone       VARCHAR(100) DEFAULT '',
      website     VARCHAR(500) DEFAULT '',
      email       VARCHAR(255) DEFAULT '',
      maps_url    VARCHAR(1000) DEFAULT '',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES campaign_locations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // MySQL has no CREATE INDEX IF NOT EXISTS — probe information_schema instead.
  await ensureIndex(pool, "idx_biz_campaign", "businesses", "campaign_id");
  await ensureIndex(pool, "idx_biz_location", "businesses", "location_id");
  await ensureIndex(
    pool,
    "idx_loc_campaign",
    "campaign_locations",
    "campaign_id",
  );
}

/** Creates an index only when one with the same name does not exist. */
async function ensureIndex(pool, indexName, table, column) {
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

module.exports = { createSchema };

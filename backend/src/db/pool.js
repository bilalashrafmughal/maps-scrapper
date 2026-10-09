"use strict";

const mysql = require("mysql2/promise");
const config = require("../config/env");
const { createSchema } = require("./schema");

let pool = null;

/**
 * Returns the singleton connection pool, creating it (and ensuring the schema)
 * on first call.
 */
async function getDb() {
  if (pool) return pool;

  pool = mysql.createPool({ ...config.db, ...config.pool });
  await createSchema(pool);

  console.log(
    `✅ MySQL connected — database '${config.db.database || "uri"}' ready`,
  );
  return pool;
}

/** Raw pool accessor for modules that need it directly. */
function getPool() {
  if (!pool) throw new Error("Database not initialised — call getDb() first.");
  return pool;
}

/** Closes the pool (used on graceful shutdown). */
async function closeDb() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = { getDb, getPool, closeDb };

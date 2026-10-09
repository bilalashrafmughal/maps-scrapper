"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Loads KEY=VALUE pairs from backend/.env into process.env.
 * Kept dependency-free (no dotenv package) — existing keys are never overwritten.
 */
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

/** Strips query params that the mysql2 driver rejects from a connection URI. */
function normalizeDatabaseUrl(url) {
  return url
    .replace(
      /\?(connection_limit|socket_timeout|connect_timeout)=[^&]+&?/g,
      "",
    )
    .replace(/[?&]$/, "");
}

const DATABASE_URL = process.env.DATABASE_URL;

const config = {
  port: parseInt(process.env.PORT, 10) || 8080,
  nodeEnv: process.env.NODE_ENV || "development",

  /** Resume interrupted (pending/running) campaigns on boot. */
  resumeOnStart: process.env.RESUME_ON_START !== "false",

  /** Opt-in: also retry campaigns left in the 'failed' state on boot. */
  resumeFailed: process.env.RESUME_FAILED === "true",

  /** Background scheduler: how often to check for pending campaigns (ms). */
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED !== "false",
    intervalMs: parseInt(process.env.SCHEDULER_INTERVAL_MS, 10) || 60_000,
    /** Connectivity probe target + timeout. */
    connectivityUrl:
      process.env.CONNECTIVITY_URL || "https://www.google.com/generate_204",
    connectivityTimeoutMs:
      parseInt(process.env.CONNECTIVITY_TIMEOUT_MS, 10) || 5000,
  },

  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "25mb",

  db: DATABASE_URL
    ? { uri: normalizeDatabaseUrl(DATABASE_URL) }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "leads",
      },

  pool: {
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_LIMIT, 10) || 10,
    queueLimit: 0,
  },
};

module.exports = config;

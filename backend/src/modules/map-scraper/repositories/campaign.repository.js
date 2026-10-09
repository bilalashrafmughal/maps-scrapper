"use strict";

const { getPool } = require("../../../db");

/** Inserts a campaign row and returns its new id. */
async function insert({
  name,
  query,
  maxResults,
  delayMs,
  emailConcurrency,
  emailRequired,
}) {
  const [result] = await getPool().execute(
    `INSERT INTO campaigns (name, query, max_results, delay_ms, email_concurrency, email_required)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, query, maxResults, delayMs, emailConcurrency, emailRequired ? 1 : 0],
  );
  return result.insertId;
}

async function findById(id) {
  const [rows] = await getPool().execute(
    `SELECT * FROM campaigns WHERE id = ?`,
    [id],
  );
  return rows.length ? rows[0] : null;
}

async function findAll() {
  const [rows] = await getPool().execute(
    `SELECT * FROM campaigns ORDER BY created_at DESC`,
  );
  return rows;
}

async function updateStatus(id, status) {
  await getPool().execute(`UPDATE campaigns SET status = ? WHERE id = ?`, [
    status,
    id,
  ]);
}

/** Updates the editable option fields (not locations). */
async function updateOptions(
  id,
  { query, maxResults, delayMs, emailConcurrency, emailRequired },
) {
  await getPool().execute(
    `UPDATE campaigns
        SET query = ?, max_results = ?, delay_ms = ?, email_concurrency = ?, email_required = ?
      WHERE id = ?`,
    [query, maxResults, delayMs, emailConcurrency, emailRequired ? 1 : 0, id],
  );
}

async function remove(id) {
  const [result] = await getPool().execute(
    `DELETE FROM campaigns WHERE id = ?`,
    [id],
  );
  return result.affectedRows > 0;
}

/** Campaigns eligible for resuming on boot. */
async function findResumable(statuses) {
  if (!statuses.length) return [];
  const placeholders = statuses.map(() => "?").join(", ");
  const [rows] = await getPool().execute(
    `SELECT * FROM campaigns WHERE status IN (${placeholders}) ORDER BY created_at ASC`,
    statuses,
  );
  return rows;
}

module.exports = {
  insert,
  findById,
  findAll,
  updateStatus,
  updateOptions,
  remove,
  findResumable,
};

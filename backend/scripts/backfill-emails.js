"use strict";

/**
 * TEMPORARY one-off backfill script.
 *
 * Researches the websites of every business in a campaign and fills in the
 * `email` column. Businesses with no discoverable email are skipped (left as-is).
 *
 * Usage:
 *   node scripts/backfill-emails.js [campaignId] [--concurrency=3] [--limit=N] [--dry-run]
 *
 * Examples:
 *   node scripts/backfill-emails.js 40
 *   node scripts/backfill-emails.js 40 --concurrency=5
 *   node scripts/backfill-emails.js 40 --limit=10 --dry-run
 *
 * Safe to re-run: already-filled emails are skipped unless --overwrite is set.
 */

const { chromium } = require("playwright");

const { getDb, getPool, closeDb } = require("../src/db");
const {
  researchWebsiteEmails,
  createEmailContext,
} = require("../src/modules/map-scraper/scraper/emailExtractor");

// ── CLI parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    campaignId: 40,
    concurrency: 3,
    limit: 0,
    budgetMs: 25000,
    dryRun: false,
    overwrite: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--concurrency=")) {
      args.concurrency = parseInt(arg.split("=")[1], 10) || 3;
    } else if (arg.startsWith("--limit=")) {
      args.limit = parseInt(arg.split("=")[1], 10) || 0;
    } else if (arg.startsWith("--budget=")) {
      args.budgetMs = parseInt(arg.split("=")[1], 10) || 25000;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (/^\d+$/.test(arg)) {
      args.campaignId = parseInt(arg, 10);
    }
  }

  args.concurrency = Math.max(1, Math.min(args.concurrency, 10));
  return args;
}

// ── DB helpers ──────────────────────────────────────────────────────────────

async function loadBusinesses(campaignId, { limit, overwrite }) {
  const emailFilter = overwrite
    ? "1=1"
    : "(email IS NULL OR email = '')";

  // MySQL cannot bind LIMIT as a prepared parameter, so the (validated,
  // integer-only) limit is inlined into the statement.
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 0;
  const sql =
    `SELECT id, name, website FROM businesses
      WHERE campaign_id = ? AND website IS NOT NULL AND website <> '' AND ${emailFilter}
      ORDER BY id ASC` + (safeLimit > 0 ? ` LIMIT ${safeLimit}` : "");

  const [rows] = await getPool().execute(sql, [campaignId]);
  return rows;
}

async function saveEmail(id, email) {
  await getPool().execute(`UPDATE businesses SET email = ? WHERE id = ?`, [
    email,
    id,
  ]);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\n📧 Email backfill — campaign #${args.campaignId}`);
  console.log(
    `   concurrency=${args.concurrency}` +
      ` budget=${Math.round(args.budgetMs / 1000)}s` +
      `${args.limit ? ` limit=${args.limit}` : ""}` +
      `${args.dryRun ? " [DRY RUN]" : ""}` +
      `${args.overwrite ? " [OVERWRITE]" : ""}\n`,
  );

  await getDb();

  const businesses = await loadBusinesses(args.campaignId, args);
  if (businesses.length === 0) {
    console.log("Nothing to do — no businesses with a website and no email.");
    await closeDb();
    return;
  }
  console.log(`Found ${businesses.length} business(es) to research.\n`);

  const stats = { found: 0, skipped: 0, failed: 0, done: 0 };
  const queue = [...businesses];

  const browser = await chromium.launch({ headless: true });
  const context = await createEmailContext(browser);

  const worker = async () => {
    while (queue.length > 0) {
      const biz = queue.shift();
      if (!biz) break;

      let email = "";
      try {
        const out = await researchWebsiteEmails(context, biz.website, {
          overallBudgetMs: args.budgetMs,
        });
        email = out.email || "";
      } catch (err) {
        stats.failed++;
      }

      if (email) {
        if (!args.dryRun) {
          try {
            await saveEmail(biz.id, email);
          } catch (err) {
            stats.failed++;
            email = "";
            console.log(`\n  ⚠️  DB update failed for #${biz.id}: ${err.message}`);
          }
        }
        if (email) stats.found++;
      } else {
        stats.skipped++;
      }

      stats.done++;
      const label = (biz.name || `#${biz.id}`).slice(0, 26).padEnd(26);
      process.stdout.write(
        `\r  [${String(stats.done).padStart(4)}/${businesses.length}] ${label}  ${email || "(skipped)"}      `,
      );
      // A persistent line every 25 records survives interleaved concurrent output.
      if (stats.done % 25 === 0 || stats.done === businesses.length) {
        process.stdout.write(
          `\n  progress: ${stats.done}/${businesses.length} — ${stats.found} found, ${stats.skipped} skipped, ${stats.failed} failed\n`,
        );
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: args.concurrency }, () => worker()),
    );
  } finally {
    process.stdout.write("\n");
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  console.log(`\n✅ Done.`);
  console.log(`   updated : ${stats.found}`);
  console.log(`   skipped : ${stats.skipped} (no email found)`);
  console.log(`   failed  : ${stats.failed}`);

  await closeDb();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await closeDb().catch(() => {});
  process.exit(1);
});

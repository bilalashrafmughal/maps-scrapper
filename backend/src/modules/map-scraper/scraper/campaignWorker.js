"use strict";

const { chromium } = require("playwright");
const { scrapeGoogleMaps } = require("./googleMapsScraper");
const {
  researchWebsiteEmails,
  createEmailContext,
} = require("./emailExtractor");
const campaignRepo = require("../repositories/campaign.repository");
const locationRepo = require("../repositories/location.repository");
const businessRepo = require("../repositories/business.repository");
const {
  CAMPAIGN_STATUS,
  LOCATION_STATUS,
} = require("../../../config/constants");

/**
 * In-memory registry of running campaigns so they can be paused/stopped.
 * Values are the desired state: 'running' | 'paused' | 'stopped'.
 */
const runningCampaigns = new Map();

/** Most recent worker promise per campaign. */
const workers = new Map();

function isActive(campaignId) {
  return workers.has(campaignId);
}

/** Signals a running worker to stop between locations. */
function requestStop(campaignId) {
  if (runningCampaigns.has(campaignId)) {
    runningCampaigns.set(campaignId, "stopped");
    return true;
  }
  return false;
}

/** Signals a running worker to pause between locations. */
function requestPause(campaignId) {
  if (runningCampaigns.has(campaignId)) {
    runningCampaigns.set(campaignId, "paused");
    return true;
  }
  return false;
}

/** Blocks while a campaign is paused; returns when resumed or stopped. */
async function waitWhilePaused(campaignId) {
  while (runningCampaigns.get(campaignId) === "paused") {
    await sleep(750);
    const fresh = await campaignRepo.findById(campaignId);
    if (fresh && fresh.status === CAMPAIGN_STATUS.RUNNING) {
      runningCampaigns.set(campaignId, "running");
    }
  }
}

/**
 * Processes all pending locations for a campaign sequentially.
 *
 * For each location: mark running → scrape → (optional) mine emails →
 * persist businesses → mark completed/failed. Fire-and-forget; callers poll.
 *
 * @param {number} campaignId
 * @param {object} campaign  Campaign row (query/max_results/delay_ms/email_required)
 * @returns {Promise<void>}
 */
function runCampaignWorker(campaignId, campaign) {
  if (workers.has(campaignId)) return workers.get(campaignId);

  const promise = execute(campaignId, campaign).finally(() => {
    workers.delete(campaignId);
    runningCampaigns.delete(campaignId);
  });

  workers.set(campaignId, promise);
  runningCampaigns.set(campaignId, "running");
  return promise;
}

async function execute(campaignId, campaign) {
  await sleep(500);
  await campaignRepo.updateStatus(campaignId, CAMPAIGN_STATUS.RUNNING);

  while (true) {
    if (runningCampaigns.get(campaignId) === "stopped") {
      console.log(`\n⏹  Campaign #${campaignId} stopped.`);
      return;
    }

    await waitWhilePaused(campaignId);
    if (runningCampaigns.get(campaignId) === "stopped") return;

    const pending = await locationRepo.findPending(campaignId);
    if (pending.length === 0) break;

    const loc = pending[0];
    await locationRepo.updateStatus(loc.id, LOCATION_STATUS.RUNNING);
    console.log(`\n📍 [${loc.location}] — scraping...`);

    // ── Scrape ────────────────────────────────────────────────────────────
    let businesses = [];
    try {
      businesses = await scrapeGoogleMaps({
        query: `${campaign.query}`,
        location: `${loc.city || loc.location}`,
        maxResults: campaign.max_results,
        delayBetweenRequests: campaign.delay_ms,
      });
    } catch (err) {
      console.error(`\n  ❌ Scrape error for "${loc.location}": ${err.message}`);
      await locationRepo.updateStatus(loc.id, LOCATION_STATUS.FAILED, {
        errorMsg: String(err.message).substring(0, 500),
      });
      continue;
    }

    if (businesses.length === 0) {
      await locationRepo.updateStatus(loc.id, LOCATION_STATUS.COMPLETED, {
        itemsScraped: 0,
      });
      continue;
    }

    // ── Email research (opt-in) ───────────────────────────────────────────
    if (campaign.email_required) {
      businesses = await mineEmails(businesses, campaign.email_concurrency);
    }

    // ── Persist ───────────────────────────────────────────────────────────
    const rows = businesses.map((biz) => ({
      ...biz,
      campaignId,
      locationId: loc.id,
    }));
    if (rows.length > 0) await businessRepo.insertMany(rows);

    await locationRepo.updateStatus(loc.id, LOCATION_STATUS.COMPLETED, {
      itemsScraped: rows.length,
    });
    console.log(`  ✅ ${loc.location} — ${rows.length} business(es) saved.\n`);
  }

  await campaignRepo.updateStatus(campaignId, CAMPAIGN_STATUS.COMPLETED);
  console.log(`\n🏁 Campaign #${campaignId} completed!`);
}

/**
 * Researches each business website for contact emails using a bounded
 * worker-pool, then drops businesses without one (matches the
 * "emailRequired filters results" behaviour).
 *
 * Concurrency is driven by the campaign's `email_concurrency`. Each site is
 * researched independently, so one failing website never affects the others.
 */
async function mineEmails(businesses, concurrency = 3) {
  const withWebsite = businesses.filter((b) => b.website);
  console.log(
    `  ✉️  Researching emails for ${withWebsite.length} website(s) ` +
      `(${businesses.length - withWebsite.length} without a site)...`,
  );

  if (withWebsite.length === 0) {
    return businesses.filter((b) => b.email);
  }

  const limit = Math.max(1, Math.min(concurrency, 10));
  const stats = { found: 0, done: 0, failed: 0 };
  let browser = null;
  let context = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await createEmailContext(browser);

    const queue = [...withWebsite];

    const worker = async () => {
      while (queue.length > 0) {
        const biz = queue.shift();
        if (!biz) break;

        try {
          const { email } = await researchWebsiteEmails(context, biz.website);
          biz.email = email || "";
          if (biz.email) stats.found++;
        } catch (err) {
          // Isolate per-site failures — keep going.
          biz.email = biz.email || "";
          stats.failed++;
          if (stats.failed <= 3) {
            console.log(
              `\n  ⚠️  ${biz.website}: ${err?.message || "lookup failed"}`,
            );
          }
        } finally {
          stats.done++;
          const label = (biz.name || "").slice(0, 22).padEnd(22);
          process.stdout.write(
            `\r  [${String(stats.done).padStart(3)}/${withWebsite.length}] ${label}  ${biz.email || "(none)"}      `,
          );
        }
      }
    };

    await Promise.all(Array.from({ length: limit }, worker));
    process.stdout.write("\n");
    console.log(
      `  ✉️  Email research complete — ${stats.found}/${withWebsite.length} matched` +
        (stats.failed ? `, ${stats.failed} failed` : "") +
        ".",
    );
  } catch (err) {
    console.error(`\n  ⚠️  Email research error: ${err.message}`);
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  const kept = businesses.filter((b) => b.email);
  const removed = businesses.length - kept.length;
  if (removed > 0) {
    console.log(`  🗑  Removed ${removed} business(es) without email.`);
  }
  return kept;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { runCampaignWorker, requestStop, requestPause, isActive };

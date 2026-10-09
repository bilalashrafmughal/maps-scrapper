"use strict";

const config = require("../../../config/env");
const {
  CAMPAIGN_STATUS,
  UNFINISHED_CAMPAIGN_STATUSES,
} = require("../../../config/constants");
const { checkInternet } = require("../../../utils/connectivity");
const campaignRepo = require("../repositories/campaign.repository");
const { runCampaignWorker, isActive } = require("./campaignWorker");

/**
 * Background scheduler.
 *
 * Every `config.scheduler.intervalMs` (default 60s) it:
 *   1. checks internet connectivity — if offline, it skips this tick;
 *   2. loads campaigns that still need work (pending/running, plus failed when
 *      RESUME_FAILED=true);
 *   3. dispatches a worker for each one that isn't already running.
 *
 * Design goals: the tick NEVER throws and NEVER stops the loop. Every failure is
 * logged as a gentle one-line message and the scheduler carries on.
 */

const TICK_LOG = {
  offline: "📡 Internet unavailable — skipping this tick.",
  noWork: "💤 No pending campaigns.",
};

let timer = null;
let ticking = false;
let tickCount = 0;

/** Starts the scheduler (idempotent). */
function start() {
  if (!config.scheduler.enabled) {
    console.log("⏭  Scheduler disabled (SCHEDULER_ENABLED=false).");
    return;
  }
  if (timer) return;

  const { intervalMs } = config.scheduler;
  console.log(
    `⏱  Scheduler started — checking every ${Math.round(intervalMs / 1000)}s.`,
  );

  timer = setInterval(() => {
    // Skip if the previous tick is still running (slow network / long DB work).
    if (ticking) return;
    runTick().catch((err) => {
      // Defensive: runTick already swallows errors, but never let one escape.
      console.error(`⚠️  Scheduler tick crashed: ${err?.message || err}`);
    });
  }, intervalMs);

  timer.unref?.(); // do not keep the process alive on our account
}

/** Stops the scheduler. */
function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log("⏹  Scheduler stopped.");
}

/** Runs a single scheduling pass. Never throws. */
async function runTick() {
  ticking = true;
  tickCount++;
  const tag = `[scheduler #${tickCount}]`;

  try {
    const net = await checkInternet({
      url: config.scheduler.connectivityUrl,
      timeoutMs: config.scheduler.connectivityTimeoutMs,
    });

    if (!net.online) {
      console.log(`${tag} ${TICK_LOG.offline} (${net.reason || "unknown"})`);
      return;
    }

    const statuses = [...UNFINISHED_CAMPAIGN_STATUSES];
    if (config.resumeFailed) statuses.push(CAMPAIGN_STATUS.FAILED);

    let campaigns;
    try {
      campaigns = await campaignRepo.findResumable(statuses);
    } catch (err) {
      console.error(`${tag} ⚠️  Could not load campaigns: ${err.message}`);
      return;
    }

    if (campaigns.length === 0) {
      console.log(`${tag} ${TICK_LOG.noWork}`);
      return;
    }

    for (const campaign of campaigns) {
      await dispatch(campaign, tag);
    }
  } catch (err) {
    // Last line of defence — log gently and let the next tick retry.
    console.error(`${tag} ⚠️  Unexpected scheduler error: ${err?.message || err}`);
  } finally {
    ticking = false;
  }
}

/**
 * Starts a worker for a single campaign, isolating its failures so one bad
 * campaign cannot affect the others.
 */
async function dispatch(campaign, tag) {
  try {
    if (isActive(campaign.id)) {
      console.log(
        `${tag} ↻ Campaign #${campaign.id} already running — skipping.`,
      );
      return;
    }

    console.log(
      `${tag} ▶ Campaign #${campaign.id} "${campaign.query}" (${campaign.status})`,
    );

    // A previously-failed campaign must be re-queued before its worker runs.
    if (campaign.status === CAMPAIGN_STATUS.FAILED) {
      await campaignRepo.updateStatus(campaign.id, CAMPAIGN_STATUS.PENDING);
      campaign.status = CAMPAIGN_STATUS.PENDING;
    }

    runCampaignWorker(campaign.id, campaign).catch(async (err) => {
      console.error(
        `${tag} ⚠️  Campaign #${campaign.id} failed: ${err?.message || err}`,
      );
      // Park the campaign as failed; it will only be retried when
      // RESUME_FAILED=true, so a permanently broken campaign won't loop.
      try {
        await campaignRepo.updateStatus(
          campaign.id,
          CAMPAIGN_STATUS.FAILED,
        );
      } catch (dbErr) {
        console.error(
          `${tag} ⚠️  Could not mark campaign #${campaign.id} failed: ${dbErr.message}`,
        );
      }
    });
  } catch (err) {
    console.error(
      `${tag} ⚠️  Could not start campaign #${campaign.id}: ${err?.message || err}`,
    );
  }
}

/** Exposed for manual triggering / testing. */
module.exports = { start, stop, runTick };

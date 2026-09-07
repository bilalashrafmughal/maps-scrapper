"use strict";

const {
  getPendingLocations,
  updateLocationStatus,
  updateCampaignStatus,
  saveBusinesses,
} = require("./database");
const { scrapeGoogleMaps } = require("./scraper");
const { extractEmail } = require("./emailExtractor");
const { chromium } = require("playwright");

/**
 * Processes all pending locations for a campaign sequentially.
 * For each location:
 *   1. Mark location 'running'
 *   2. Scrape Google Maps → collect all businesses in memory
 *   3. If emailRequired, mine websites for emails, then filter
 *   4. Save all final businesses to DB in one batch
 *   5. Mark location 'completed' (or 'failed' on error)
 *   6. Repeat for next location
 *
 * Runs asynchronously — fire-and-forget, caller polls status API.
 */
async function runCampaignWorker(campaignId, campaign) {
  await sleep(500);
  await updateCampaignStatus(campaignId, "running");

  while (true) {
    const locations = await getPendingLocations(campaignId);
    if (locations.length === 0) break;

    const loc = locations[0];
    await updateLocationStatus(loc.id, "running");
    console.log(`\n📍 [${loc.location}] — scraping...`);

    // ── Scrape ──────────────────────────────────────────────────────────────
    let businesses = [];
    try {

      console.log({
        query: `${campaign.query}`,
        location: `${loc.city || "in"}, ${loc.state}`,
        maxResults: campaign.max_results,
        delayBetweenRequests: campaign.delay_ms,
      });
      businesses = await scrapeGoogleMaps({
        query: `${campaign.query}`,
        location: `${loc.city}, ${loc.state}`,
        maxResults: campaign.max_results,
        delayBetweenRequests: campaign.delay_ms,
      });
    } catch (err) {
      console.error(
        `\n  ❌ Scrape error for "${loc.location}": ${err.message}`,
      );
      await updateLocationStatus(loc.id, "failed", {
        errorMsg: err.message.substring(0, 500),
      });
      continue;
    }

    if (businesses.length === 0) {
      await updateLocationStatus(loc.id, "completed", { itemsScraped: 0 });
      continue;
    }

    // ── Email mining (if required) ──────────────────────────────────────────
    if (campaign.email_required) {
      console.log(
        `  ✉️  Mining emails for ${businesses.length} business(es)...`,
      );
      let emailBrowser = null;
      try {
        emailBrowser = await chromium.launch({ headless: true });
        const ctx = await emailBrowser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          locale: "en-US",
        });

        const withWebsite = businesses.filter((b) => b.website);
        let completed = 0;

        for (const biz of withWebsite) {
          const page = await ctx.newPage();
          try {
            biz.email = await extractEmail(page, biz.website);
          } finally {
            await page.close();
          }
          completed++;
          const tag = biz.email || "(none)";
          const label = (biz.name || "").slice(0, 24).padEnd(24);
          process.stdout.write(
            `\r  [${String(completed).padStart(3)}/${withWebsite.length}] ${label}  ${tag}      `,
          );
        }

        await ctx.close();
        console.log("\n  ✉️  Email mining complete.");

        // Filter: keep only businesses with emails
        const before = businesses.length;
        businesses = businesses.filter((b) => b.email);
        const removed = before - businesses.length;
        if (removed > 0) {
          console.log(`  🗑  Removed ${removed} business(es) without email.`);
        }
      } catch (err) {
        console.error(`\n  ⚠️  Email mining error: ${err.message}`);
      } finally {
        if (emailBrowser) await emailBrowser.close();
      }
    }

    // ── Save all final businesses to DB ──────────────────────────────────────
    const rowsToInsert = businesses.map((biz) => ({
      campaignId,
      locationId: loc.id,
      name: biz.name || "",
      rating: biz.rating ? parseFloat(biz.rating) : null,
      reviews:
        biz.reviews != null && biz.reviews !== ""
          ? parseInt(biz.reviews, 10)
          : null,
      category: biz.category || "",
      address: biz.address || "",
      phone: biz.phone || "",
      website: biz.website || "",
      email: biz.email || "",
      mapsUrl: biz.mapsUrl || "",
    }));

    if (rowsToInsert.length > 0) {
      await saveBusinesses(rowsToInsert);
    }

    const kept = rowsToInsert.length;
    await updateLocationStatus(loc.id, "completed", { itemsScraped: kept });
    console.log(`  ✅ ${loc.location} — ${kept} business(es) saved.\n`);
  }

  await updateCampaignStatus(campaignId, "completed");
  console.log(`\n🏁 Campaign #${campaignId} completed!`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { runCampaignWorker };

"use strict";

const { chromium } = require("playwright");

const MAPS_SEARCH_URL = "https://www.google.com/maps/search/";

/**
 * Scrapes Google Maps for a single location and returns business data.
 * Optionally accepts `onBusiness` callback for incremental persistence.
 *
 * @param {object} opts
 * @param {string} opts.query
 * @param {string} opts.location
 * @param {number} opts.maxResults
 * @param {number} opts.delayBetweenRequests
 * @param {function} [opts.onBusiness]  Called with each extracted business
 * @returns {Promise<object[]>}
 */
async function scrapeGoogleMaps({
  query,
  location,
  maxResults,
  delayBetweenRequests = 1000,
  onBusiness,
}) {
  const searchQuery = `${query} ${location}`;
  const searchUrl = `${MAPS_SEARCH_URL}${encodeURIComponent(searchQuery)}`;

  console.log("  Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    console.log(`  Navigating to: "${searchQuery}"`);
    await page.goto(searchUrl, { waitUntil: "load", timeout: 30000 });

    // Dismiss cookie / consent dialog if present
    await dismissConsent(page);

    // Wait for the scrollable results feed
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch {
      throw new Error(
        "Results feed not found. Google Maps layout may have changed or the query returned no results.",
      );
    }
    console.log("  Results feed detected. Scrolling...");

    // ── Phase 1: Collect listing links by scrolling ───────────────────────
    const listingLinks = await collectListingLinks(page, maxResults);
    console.log(`\nCollected ${listingLinks.length} listing link(s).`);

    if (listingLinks.length === 0) {
      return [];
    }

    // ── Phase 2: Visit each listing and extract detail data ───────────────
    const businesses = [];
    for (let i = 0; i < listingLinks.length; i++) {
      process.stdout.write(
        `\r  Extracting [${i + 1}/${listingLinks.length}]...`,
      );
      try {
        const data = await extractBusinessDetail(page, listingLinks[i]);
        data.mapsUrl = listingLinks[i];
        businesses.push(data);
        if (onBusiness) onBusiness(data);
      } catch (err) {
        // Non-fatal: log and continue
        console.error(
          `\n  Skipped (${listingLinks[i].slice(0, 60)}...): ${err.message}`,
        );
      }
      await sleep(delayBetweenRequests + Math.random() * 500);
    }
    console.log(`\n  Done — ${businesses.length} businesses extracted.`);

    return businesses;
  } finally {
    await browser.close();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Tries to dismiss the Google consent / cookie dialog.
 * Silently ignored if not present.
 */
async function dismissConsent(page) {
  try {
    await page
      .locator('button:has-text("Accept all"), form[action*="consent"] button')
      .first()
      .click({ timeout: 3000 });
    await sleep(600);
  } catch {}
}

/**
 * Scrolls the results feed panel until we have `maxResults` links,
 * hit the end-of-list sentinel, or stall too many times.
 *
 * @returns {Promise<string[]>}
 */
async function collectListingLinks(page, maxResults) {
  const links = new Set();
  let stalledRuns = 0;
  const MAX_STALLS = 5;

  while (links.size < maxResults && stalledRuns < MAX_STALLS) {
    // Collect all /maps/place/ hrefs from inside the results feed only
    const found = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      const root = feed || document;
      return Array.from(root.querySelectorAll('a[href*="/maps/place/"]'))
        .map((a) => a.href)
        .filter((v, i, arr) => arr.indexOf(v) === i); // unique
    });

    const prevSize = links.size;
    for (const href of found) {
      links.add(href);
      if (links.size >= maxResults) break;
    }

    process.stdout.write(`\rScrolling results: ${links.size} found...`);

    if (links.size >= maxResults) break;

    // Check Google's end-of-list marker
    const reachedEnd = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      return feed ? feed.innerText.includes("You've reached the end") : false;
    });
    if (reachedEnd) {
      console.log("\nEnd of results list reached.");
      break;
    }

    // Scroll the feed panel (not the whole page)
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollBy(0, 700);
    });

    await sleep(1800);

    stalledRuns = links.size === prevSize ? stalledRuns + 1 : 0;
  }

  return Array.from(links).slice(0, maxResults);
}

/**
 * Navigates to a single Google Maps place URL and extracts all business fields.
 *
 * @returns {Promise<object>}
 */
async function extractBusinessDetail(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

  // Wait for the title to render
  try {
    await page.waitForSelector("h1", { timeout: 8000 });
  } catch {}

  await sleep(700);

  const data = await page.evaluate(() => {
    // ── Utilities ────────────────────────────────────────────────────────
    const innerText = (el) =>
      el ? (el.innerText || el.textContent || "").trim() : "";

    // ── Name ─────────────────────────────────────────────────────────────
    const name = innerText(document.querySelector("h1"));

    // ── Rating + Review count ─────────────────────────────────────────────
    // Google Maps stores these in aria-labels: "4.5 stars" and "1,234 reviews"
    let rating = "";
    let reviews = "";
    for (const el of document.querySelectorAll("[aria-label]")) {
      const lbl = el.getAttribute("aria-label") || "";
      if (!rating) {
        const m = lbl.match(/^([\d.]+)\s*stars?/i);
        if (m) rating = m[1];
      }
      if (!reviews) {
        const m = lbl.match(/([\d,]+)\s*reviews?/i);
        if (m) reviews = m[1].replace(/,/g, "");
      }
      if (rating && reviews) break;
    }

    // ── Category ─────────────────────────────────────────────────────────
    // Google Maps obfuscates class names; try several known patterns
    let category = "";
    for (const sel of [
      "button.DkEaL",
      '[jsaction*="category"]',
      '[data-attrid*="category"]',
      ".mgr77e span",
      '[aria-label*="category" i]',
    ]) {
      const el = document.querySelector(sel);
      if (el) {
        category = innerText(el);
        break;
      }
    }

    // ── Address ───────────────────────────────────────────────────────────
    // data-item-id="address" is stable; prefer aria-label to avoid sub-element noise
    let address = "";
    const addrEl = document.querySelector('[data-item-id="address"]');
    if (addrEl) {
      const lbl = addrEl.getAttribute("aria-label") || "";
      address = lbl.replace(/^address:\s*/i, "").trim() || innerText(addrEl);
    }

    // ── Phone ─────────────────────────────────────────────────────────────
    let phone = "";
    const phoneEl = Array.from(
      document.querySelectorAll("[data-item-id]"),
    ).find((el) =>
      (el.getAttribute("data-item-id") || "").startsWith("phone:"),
    );
    if (phoneEl) {
      const lbl = phoneEl.getAttribute("aria-label") || "";
      phone = lbl.replace(/^phone:\s*/i, "").trim() || innerText(phoneEl);
    }

    // ── Website ───────────────────────────────────────────────────────────
    let website = "";
    const websiteEl =
      document.querySelector('a[data-item-id="authority"]') ||
      Array.from(document.querySelectorAll("a[aria-label]")).find((a) =>
        /website/i.test(a.getAttribute("aria-label") || ""),
      );
    if (websiteEl) website = websiteEl.href || "";

    return {
      name,
      rating,
      reviews,
      category,
      address,
      phone,
      website,
      email: "",
    };
  });

  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { scrapeGoogleMaps };

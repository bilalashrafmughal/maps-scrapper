"use strict";

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Domains/patterns that commonly appear in source code but are not real contact emails
const NOISE_PATTERNS = [
  "example.com",
  "sentry.io",
  "wixpress.com",
  "schema.org",
  "yoursite.",
  "domain.com",
  "test.com",
  "email.com",
  "placeholder",
];

/**
 * Visits a business website and attempts to find a contact email address.
 * Strategy:
 *   1. Scan home page for mailto: links
 *   2. Scan home page text with email regex
 *   3. Try /contact, /contact-us, /about, /about-us pages
 *
 * @param {import('playwright').Page} page   A Playwright page instance (caller owns lifecycle)
 * @param {string}                    websiteUrl
 * @returns {Promise<string>}  First valid email found, or empty string
 */
async function extractEmail(page, websiteUrl) {
  if (!websiteUrl) return "";

  // ── Inner helper: scan the currently loaded page for emails ─────────────
  const scanCurrentPage = async () => {
    // Priority 1: explicit mailto: href
    const mailtoEmails = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="mailto:"]'))
        .map((a) => a.href.slice(7).split("?")[0].trim())
        .filter(Boolean),
    );
    for (const email of mailtoEmails) {
      if (isValidEmail(email)) return email;
    }

    // Priority 2: regex scan of visible text
    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    const matches = bodyText.match(EMAIL_REGEX) || [];
    for (const email of matches) {
      if (isValidEmail(email)) return email;
    }

    return "";
  };

  try {
    await page.goto(websiteUrl, {
      waitUntil: "domcontentloaded",
      timeout: 12000,
    });
    await sleep(600);

    const homeEmail = await scanCurrentPage();
    if (homeEmail) return homeEmail;

    // ── Fallback: try common contact/about paths ─────────────────────────
    let origin;
    try {
      origin = new URL(websiteUrl).origin;
    } catch {
      return ""; // malformed URL
    }

    const fallbackPaths = ["/contact", "/contact-us", "/about", "/about-us"];
    for (const subPath of fallbackPaths) {
      try {
        await page.goto(`${origin}${subPath}`, {
          waitUntil: "domcontentloaded",
          timeout: 8000,
        });
        await sleep(400);
        const email = await scanCurrentPage();
        if (email) return email;
      } catch {
        // Path doesn't exist or timed out — continue to next
      }
    }
  } catch {
    // Navigation error (SSL, timeout, DNS, etc.) — return empty
  }

  return "";
}

/**
 * Returns true if the email looks like a real contact address
 * (not a noise/placeholder/framework email).
 */
function isValidEmail(email) {
  if (!email || !email.includes("@")) return false;
  const lower = email.toLowerCase();
  return !NOISE_PATTERNS.some((p) => lower.includes(p));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { extractEmail };

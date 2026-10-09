"use strict";

/**
 * Website email-research pipeline.
 *
 * Built on the `email-scraper` library (extractAndNormalizeEmails /
 * scrapeEmailsFromWebsite) but optimised for our use case:
 *
 *   priority contact pages  →  home page  →  bounded same-domain crawl
 *                           →  merge → noise filter → rank → best pick
 *
 * Contact/about pages are visited first because they hold the vast majority of
 * real contact addresses, so most sites resolve without a deep crawl. The deep
 * crawl is capped by depth *and* page budget, and a whole-site time budget
 * stops one slow business from stalling an entire campaign.
 *
 * Every stage is failure-isolated: a broken page or malformed URL never throws
 * out of the pipeline — it just yields whatever was collected so far.
 */

const {
  extractAndNormalizeEmails,
  scrapeEmailsFromWebsite,
} = require("email-scraper");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * High-yield paths, ordered by likelihood of holding a contact address.
 * Contact first; legal/imprint pages often carry a registered address too.
 */
const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contactus",
  "/about",
  "/about-us",
  "/aboutus",
  "/get-in-touch",
  "/reach-us",
  "/support",
  "/imprint",
  "/impressum",
  "/legal",
];

/** Domains/patterns that are never real contact addresses. */
const NOISE_PATTERNS = [
  "example.com",
  "example.org",
  "sentry.io",
  "wixpress.com",
  "schema.org",
  "yoursite.",
  "yourdomain.",
  "domain.com",
  "test.com",
  "email.com",
  "placeholder",
  "cloudflare",
  "w3.org",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
];

/** Local-part prefixes signalling a generic/role mailbox rather than a person. */
const GENERIC_PREFIXES = [
  "info",
  "contact",
  "hello",
  "hi",
  "sales",
  "support",
  "admin",
  "office",
  "enquiries",
  "enquiry",
  "inquiries",
  "help",
  "team",
  "mail",
  "general",
];

/** Free/consumer providers — accepted, but ranked below domain mail. */
const FREEMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "live.com",
  "protonmail.com",
];

const DEFAULTS = {
  pageTimeoutMs: 12000,
  settleMs: 500,
  /** Fast reachability probe before spending browser time. */
  probeTimeoutMs: 4000,
  /** Hard cap on pages visited per website. */
  maxPages: 8,
  /** Crawl depth for the library's deep pass. */
  maxDepth: 2,
  /** Give up on a site after this long. */
  overallBudgetMs: 45000,
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Researches a website for contact email addresses.
 *
 * @param {import('playwright').BrowserContext} context  Shared browser context.
 * @param {string} websiteUrl
 * @param {object} [options]
 * @returns {Promise<{email: string, emails: string[], pagesVisited: number, durationMs: number}>}
 *          `email` is the best-ranked address ("" when none found).
 */
async function researchWebsiteEmails(context, websiteUrl, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const startedAt = Date.now();
  const found = new Set();
  let pagesVisited = 0;

  const result = (extra = {}) => {
    const siteDomain = safeHostname(websiteUrl);
    return {
      email: pickBest(Array.from(found), siteDomain) || "",
      emails: rankEmails(Array.from(found), siteDomain),
      pagesVisited,
      durationMs: Date.now() - startedAt,
      ...extra,
    };
  };

  if (!websiteUrl) return result({ reason: "no website" });

  let origin;
  try {
    origin = new URL(websiteUrl).origin;
  } catch {
    return result({ reason: "malformed url" });
  }

  const deadline = startedAt + opts.overallBudgetMs;

  // ── Stage 0: cheap reachability probe ────────────────────────────────────
  // A single quick request tells us whether the host is worth any browser work.
  // Unreachable hosts (DNS failures, timeouts, TLS errors) are abandoned here
  // instead of costing several full page-load timeouts below.
  const reachable = await isReachable(origin, opts.probeTimeoutMs);
  if (!reachable) {
    return result({ reason: "host unreachable" });
  }

  // ── Stage 1: priority contact pages ──────────────────────────────────────
  // Track consecutive hard failures so a partially-broken site does not burn
  // the whole budget retrying every candidate path.
  let consecutiveFailures = 0;

  for (const pathSuffix of CONTACT_PATHS) {
    if (outOfBudget(deadline, pagesVisited, opts)) break;
    if (consecutiveFailures >= 2) break; // host degraded — stop probing

    const page = await openPage(context);
    if (!page) break;

    try {
      const emails = await scrapePage(page, `${origin}${pathSuffix}`, opts);
      pagesVisited++;
      consecutiveFailures = 0;
      emails.forEach((e) => found.add(e));
      // A contact-page hit is the strongest signal — stop widening.
      if (found.size > 0 && isContactPath(pathSuffix)) break;
    } catch {
      consecutiveFailures++;
    } finally {
      await closePage(page);
    }
  }

  // ── Stage 2: home page ───────────────────────────────────────────────────
  if (!outOfBudget(deadline, pagesVisited, opts) && consecutiveFailures < 2) {
    const page = await openPage(context);
    if (page) {
      try {
        const emails = await scrapePage(page, origin, opts);
        pagesVisited++;
        emails.forEach((e) => found.add(e));
      } catch {
        // ignore
      } finally {
        await closePage(page);
      }
    }
  }

  // ── Stage 3: bounded deep crawl, only if still empty ─────────────────────
  if (found.size === 0 && !outOfBudget(deadline, pagesVisited, opts)) {
    const remaining = Math.max(opts.maxPages - pagesVisited, 0);
    if (remaining > 0) {
      try {
        const crawled = await scrapeEmailsFromWebsite(origin, {
          maxDepth: opts.maxDepth,
          maxPages: remaining,
          sameDomainOnly: true,
          timeout: opts.pageTimeoutMs,
          useBrowser: false, // fast HTTP pass
        });
        crawled.forEach((e) => found.add(e));
      } catch {
        // ignore — shallow results still stand
      }
    }
  }

  return result();
}

/**
 * Creates a shared browser context for a batch of websites.
 * Caller owns closing it.
 */
async function createEmailContext(browser) {
  return browser.newContext({ userAgent: USER_AGENT, locale: "en-US" });
}

// ── Ranking / filtering ─────────────────────────────────────────────────────

function isUsableEmail(email) {
  if (!email || !email.includes("@")) return false;
  const lower = email.toLowerCase();
  if (lower.length > 254) return false;
  return !NOISE_PATTERNS.some((p) => lower.includes(p));
}

function localPart(email) {
  return email.split("@")[0]?.toLowerCase() ?? "";
}

function domainOf(email) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/**
 * Scores an email — higher is better:
 *  - a mailbox on the site's own domain beats an unrelated one (e.g. a web
 *    designer's address in the footer) when `siteDomain` is supplied;
 *  - domain mailbox beats a freemail address;
 *  - a person's name (firstname.lastname) beats a generic role prefix;
 *  - shorter local parts tend to be the primary contact.
 */
function scoreEmail(email, siteDomain = "") {
  const local = localPart(email);
  const domain = domainOf(email);
  let score = 0;

  if (siteDomain) {
    const core = siteDomain.replace(/^www\./, "");
    if (domain === core || domain.endsWith(`.${core}`)) score += 10;
    else if (!FREEMAIL_DOMAINS.includes(domain)) score -= 6; // unrelated domain
  }

  if (FREEMAIL_DOMAINS.includes(domain)) score -= 5;
  if (/^[a-z]+\.[a-z]+$/.test(local)) score += 6; // firstname.lastname
  else if (GENERIC_PREFIXES.includes(local)) score += 8;
  else score += 4;

  score -= Math.min(local.length, 30) * 0.05;
  return score;
}

/** Dedupes, drops noise, and sorts best-first (optionally domain-aware). */
function rankEmails(emails, siteDomain = "") {
  const seen = new Set();
  const out = [];
  for (const raw of emails) {
    if (!isUsableEmail(raw)) continue;
    const email = raw.toLowerCase().trim();
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out.sort((a, b) => scoreEmail(b, siteDomain) - scoreEmail(a, siteDomain));
}

function pickBest(emails, siteDomain = "") {
  return rankEmails(emails, siteDomain)[0];
}

// ── Page helpers ────────────────────────────────────────────────────────────

async function openPage(context) {
  try {
    return await context.newPage();
  } catch {
    return null;
  }
}

async function closePage(page) {
  try {
    await page.close();
  } catch {
    // already closed
  }
}

/**
 * Navigates to a URL and extracts normalized emails. The library's extraction
 * is pure, so we reuse it against the rendered page HTML.
 */
async function scrapePage(page, url, opts) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: opts.pageTimeoutMs,
  });
  await sleep(opts.settleMs);

  // Explicit mailto: links are the most reliable signal.
  const mailtos = await page
    .evaluate(() =>
      Array.from(document.querySelectorAll('a[href^="mailto:"]'))
        .map((a) => (a.getAttribute("href") || "").slice(7).split("?")[0].trim())
        .filter(Boolean),
    )
    .catch(() => []);

  const html = await page.content().catch(() => "");
  const emails = extractAndNormalizeEmails(html);

  return rankEmails([...mailtos, ...emails]);
}

function isContactPath(pathSuffix) {
  return /contact|get-in-touch|reach-us/i.test(pathSuffix);
}

/** Hostname of a URL, or "" when it cannot be parsed. */
function safeHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Cheap reachability probe. Uses a HEAD request with a short timeout so an
 * unreachable host costs ~probeTimeoutMs instead of several page-load timeouts.
 * Any HTTP response (even 4xx/5xx) counts as reachable — we only care whether
 * the network path works.
 *
 * @returns {Promise<boolean>}
 */
async function isReachable(origin, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(origin, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    return true;
  } catch {
    // Some servers reject HEAD — retry once with GET before giving up.
    try {
      await fetch(origin, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
      return true;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

function outOfBudget(deadline, pagesVisited, opts) {
  return Date.now() > deadline || pagesVisited >= opts.maxPages;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  researchWebsiteEmails,
  createEmailContext,
  rankEmails,
  pickBest,
  isUsableEmail,
  CONTACT_PATHS,
};

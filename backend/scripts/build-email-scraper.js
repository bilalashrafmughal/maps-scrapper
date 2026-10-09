"use strict";

/**
 * The `email-scraper` GitHub dependency ships TypeScript source only (its
 * `dist/` is gitignored and the npm name is taken by an unrelated package).
 * This script compiles the package in place so `require("email-scraper")` works.
 *
 * Safe no-op when the package is missing or already built, and it never fails
 * the install — a build problem is reported as a warning.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const packageDir = path.resolve(__dirname, "..", "node_modules", "email-scraper");
const entry = path.join(packageDir, "dist", "index.js");

function log(msg) {
  console.log(`[email-scraper build] ${msg}`);
}

if (!fs.existsSync(packageDir)) {
  log("package not installed — skipping.");
  process.exit(0);
}

if (fs.existsSync(entry)) {
  log("already built — skipping.");
  process.exit(0);
}

if (!fs.existsSync(path.join(packageDir, "tsconfig.json"))) {
  log("no tsconfig.json found — skipping.");
  process.exit(0);
}

const tscJs = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);

if (!fs.existsSync(tscJs)) {
  log("typescript not available — skipping (run `npm i -D typescript`).");
  process.exit(0);
}

try {
  log("compiling TypeScript…");
  // Invoke the compiler through Node directly — this avoids Windows shell
  // quoting issues with paths that contain spaces.
  execFileSync(process.execPath, [tscJs, "-p", "tsconfig.json"], {
    cwd: packageDir,
    stdio: "pipe",
  });
  log("build complete.");
} catch (err) {
  // The upstream source references the global `fetch` without DOM/Node typings,
  // so tsc exits non-zero even though the JS output is emitted correctly.
  // The emitted files are what matter, so check for them rather than the exit code.
  if (fs.existsSync(entry)) {
    log("compiled with type warnings (fetch typings) — output is usable.");
  } else {
    const details = err?.stdout?.toString?.() || err?.message || String(err);
    log(`build failed: ${details.split("\n").slice(0, 3).join(" | ")}`);
    log("email extraction will fall back to the built-in extractor.");
  }
}

"use strict";

/**
 * Windows service wrapper for the scraper API (via node-windows).
 *
 * Install:   node scripts/service.js install
 * Uninstall: node scripts/service.js uninstall
 *
 * Requires an elevated (Administrator) shell.
 */

const path = require("path");
const fs = require("fs");
const { Service } = require("node-windows");

const backendRoot = path.join(__dirname, "..");
const logDir = path.join(backendRoot, "daemon");

/**
 * Playwright browser location shared by the interactive user and the service
 * account (LocalSystem).
 *
 * By default Playwright resolves browsers relative to the *running user's*
 * profile. A service runs as LocalSystem, so it looks under
 * `C:\WINDOWS\system32\config\systemprofile\...` and fails with
 * "Executable doesn't exist". Pinning an absolute, machine-wide path avoids
 * that, and means installing browsers once is enough for both.
 *
 * Override with the BROWSERS_PATH env var if you keep them elsewhere.
 */
const browsersPath = process.env.BROWSERS_PATH || "C:\\ms-playwright";

const service = new Service({
  name: "Maps Scraper API",
  description: "Google Maps scraping API and background campaign scheduler.",
  script: path.join(backendRoot, "src", "index.js"),
  // Working directory must be the backend root so .env and node_modules resolve.
  workingDirectory: backendRoot,
  nodeOptions: ["--max-old-space-size=2048"],
  // Restart automatically if the process exits unexpectedly.
  maxRestarts: 10,
  wait: 2, // seconds between restarts
  grow: 0.5,
  // Logs are written to backend/daemon/
  logpath: logDir,
  // Force the service to use a shared browser install (see note above).
  env: [{ name: "PLAYWRIGHT_BROWSERS_PATH", value: browsersPath }],
});

service.on("install", () => {
  console.log("✅ Service installed.");
  service.start();
});

service.on("alreadyinstalled", () => {
  console.log("ℹ️  Service is already installed.");
});

service.on("uninstall", () => {
  console.log("✅ Service uninstalled.");
});

service.on("start", () => console.log("▶  Service started."));
service.on("stop", () => console.log("⏹  Service stopped."));
service.on("error", (err) => console.error("⚠️  Service error:", err));

/**
 * Copies Playwright browsers from the current user's profile into the shared
 * path used by the service, so LocalSystem can find them.
 * No-op when the shared path is already populated.
 */
function ensureBrowsers() {
  const source = path.join(
    process.env.LOCALAPPDATA || "",
    "ms-playwright",
  );

  if (!fs.existsSync(source)) {
    console.log(
      `⚠️  No browsers found at ${source} — run "npx playwright install chromium" first.`,
    );
    return;
  }

  if (fs.existsSync(browsersPath) && fs.readdirSync(browsersPath).length > 0) {
    console.log(`ℹ️  Browsers already present at ${browsersPath}.`);
    return;
  }

  console.log(`📦 Copying Playwright browsers to ${browsersPath} ...`);
  fs.mkdirSync(browsersPath, { recursive: true });
  // Only chromium is used by the scraper; skip ffmpeg/winldd to save space.
  for (const entry of fs.readdirSync(source)) {
    if (!/^(chromium|\.links)/.test(entry)) continue;
    fs.cpSync(path.join(source, entry), path.join(browsersPath, entry), {
      recursive: true,
    });
    console.log(`   • ${entry}`);
  }
  console.log("✅ Browsers ready.");
}

const action = process.argv[2];

if (action === "install") {
  // The winsw wrapper will not create its own log directory, and crashes on
  // startup if it is missing — so ensure it exists before installing.
  fs.mkdirSync(logDir, { recursive: true });
  ensureBrowsers();
}

switch (action) {
  case "install":
    service.install();
    break;
  case "uninstall":
    service.uninstall();
    break;
  case "start":
    service.start();
    break;
  case "stop":
    service.stop();
    break;
  case "browsers":
    ensureBrowsers();
    break;
  default:
    console.log(
      "Usage: node scripts/service.js <install|uninstall|start|stop|browsers>",
    );
    process.exit(1);
}

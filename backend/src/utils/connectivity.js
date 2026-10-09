"use strict";

const https = require("https");
const http = require("http");

/**
 * Lightweight connectivity probe against a known-reliable URL.
 *
 * Never throws — offline is a normal condition to report, not an error.
 *
 * @param {object} [options]
 * @param {string} [options.url]        Probe target.
 * @param {number} [options.timeoutMs]  Abort after this many ms.
 * @returns {Promise<{online: boolean, status?: number, reason?: string}>}
 */
function checkInternet({
  url = "https://www.google.com/generate_204",
  timeoutMs = 5000,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let client;
    try {
      client = new URL(url).protocol === "http:" ? http : https;
    } catch {
      return done({ online: false, reason: `invalid probe url: ${url}` });
    }

    const req = client.request(
      url,
      { method: "GET", timeout: timeoutMs },
      (res) => {
        res.resume(); // drain the socket
        // Any HTTP response means the network path works.
        done({ online: true, status: res.statusCode });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      done({ online: false, reason: "timeout" });
    });
    req.on("error", (err) => {
      done({ online: false, reason: err.code || err.message });
    });

    req.end();
  });
}

module.exports = { checkInternet };

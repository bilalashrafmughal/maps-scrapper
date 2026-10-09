"use strict";

/**
 * Static HTML landing page listing the available API endpoints.
 * Kept as a module so app.js stays free of large template literals.
 */
module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Maps Scraper API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,.08); max-width: 720px; width: 100%; }
    h1 { font-size: 1.6rem; margin-bottom: 6px; }
    p { color: #666; margin-bottom: 12px; }
    .module { display: inline-block; font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #1565c0; background: #e8f1fb; border-radius: 999px; padding: 3px 10px; margin-bottom: 20px; }
    .endpoints { list-style: none; }
    .endpoints li { display: flex; align-items: baseline; padding: 9px 0; border-bottom: 1px solid #eee; }
    .endpoints li:last-child { border: none; }
    .method { display: inline-block; font-size: .68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; color: #fff; margin-right: 12px; min-width: 58px; text-align: center; }
    .get { background: #2e7d32; }
    .post { background: #1565c0; }
    .put { background: #e65100; }
    .patch { background: #6a1b9a; }
    .delete { background: #c62828; }
    code { font-size: .85rem; color: #444; }
    .badge { margin-left: auto; font-size: .75rem; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📍 Google Maps Scraper API</h1>
    <p>The server is running. Use the endpoints below to create and monitor scraping campaigns.</p>
    <span class="module">map-scraper module</span>
    <ul class="endpoints">
      <li><span class="method get">GET</span> <code>/api/map-scraper/health</code><span class="badge">Health check</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/stats</code><span class="badge">DB stats</span></li>
      <li><span class="method post">POST</span> <code>/api/map-scraper/campaigns</code><span class="badge">Start a new campaign</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/campaigns</code><span class="badge">List campaigns</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/campaigns/:id</code><span class="badge">Campaign detail + progress</span></li>
      <li><span class="method put">PUT</span> <code>/api/map-scraper/campaigns/:id</code><span class="badge">Update campaign</span></li>
      <li><span class="method delete">DEL</span> <code>/api/map-scraper/campaigns/:id</code><span class="badge">Delete campaign</span></li>
      <li><span class="method patch">PATCH</span> <code>/api/map-scraper/campaigns/:id/status</code><span class="badge">Update status</span></li>
      <li><span class="method post">POST</span> <code>/api/map-scraper/campaigns/:id/start</code><span class="badge">Start / resume worker</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/campaigns/:id/progress</code><span class="badge">Progress only</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/campaigns/:id/results</code><span class="badge">Scraped data</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/campaigns/:id/locations</code><span class="badge">Location statuses</span></li>
      <li><span class="method get">GET</span> <code>/api/map-scraper/campaigns/:id/export</code><span class="badge">Download Excel</span></li>
    </ul>
    <p style="margin-top:20px;font-size:.8rem;color:#999;">
      Legacy <code>/api/*</code> paths remain available as an alias.
    </p>
  </div>
</body>
</html>`;

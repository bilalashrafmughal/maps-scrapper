"use strict";

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// ── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  { header: "Name", key: "name", width: 32 },
  { header: "Rating", key: "rating", width: 10 },
  { header: "Reviews", key: "reviews", width: 12 },
  { header: "Category", key: "category", width: 24 },
  { header: "Address", key: "address", width: 46 },
  { header: "Phone", key: "phone", width: 22 },
  { header: "Website", key: "website", width: 46 },
  { header: "Email", key: "email", width: 34 },
];

const HEADER_BG = "FF4472C4"; // Blue header fill (ARGB)
const HEADER_FG = "FFFFFFFF"; // White header text
const ALT_ROW_BG = "FFDCE6F1"; // Light blue alternating row
const BORDER_CLR = "FFD3D3D3"; // Light grey cell border

/**
 * Writes an array of business objects to a formatted Excel (.xlsx) file.
 *
 * @param {object[]} businesses
 * @param {string}   outputFile   Filename (not path) — saved inside ./output/
 */
async function exportToExcel(businesses, outputFile) {
  const outputDir = path.resolve(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filePath = path.join(outputDir, outputFile);

  // ── Workbook setup ────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Google Maps Scraper";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Businesses", {
    views: [{ state: "frozen", ySplit: 1 }], // freeze header row
  });

  sheet.columns = COLUMNS;

  // ── Header row styling ────────────────────────────────────────────────────
  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_BG },
  };
  headerRow.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: false,
  };
  applyBorders(headerRow);
  headerRow.commit();

  // ── Data rows ─────────────────────────────────────────────────────────────
  businesses.forEach((biz, idx) => {
    const row = sheet.addRow({
      name: biz.name || "",
      rating: biz.rating ? parseFloat(biz.rating) : "",
      reviews: biz.reviews ? parseInt(biz.reviews, 10) : "",
      category: biz.category || "",
      address: biz.address || "",
      phone: biz.phone || "",
      website: biz.website || "",
      email: biz.email || "",
    });

    // Alternating row background
    if (idx % 2 === 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ALT_ROW_BG },
      };
    }

    // Hyperlink for website cell
    if (biz.website) {
      const cell = row.getCell("website");
      cell.value = { text: biz.website, hyperlink: biz.website };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }

    // Hyperlink for email cell
    if (biz.email) {
      const cell = row.getCell("email");
      cell.value = { text: biz.email, hyperlink: `mailto:${biz.email}` };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }

    applyBorders(row);
    row.commit();
  });

  // ── Auto-filter on header row ─────────────────────────────────────────────
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  await workbook.xlsx.writeFile(filePath);
  console.log(`\nSaved: ${filePath}`);
  console.log(`Rows:  ${businesses.length}`);
}

/** Applies a uniform thin grey border to every cell in a row. */
function applyBorders(row) {
  const border = { style: "thin", color: { argb: BORDER_CLR } };
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { top: border, left: border, bottom: border, right: border };
  });
}

module.exports = { exportToExcel };

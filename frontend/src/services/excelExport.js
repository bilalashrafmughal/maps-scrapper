import * as XLSX from "xlsx";

// Maps DB result fields to friendly column headers and order
const COLUMNS = [
  { key: "name", header: "Name", wch: 32 },
  { key: "rating", header: "Rating", wch: 10 },
  { key: "reviews", header: "Reviews", wch: 12 },
  { key: "category", header: "Category", wch: 24 },
  { key: "phone", header: "Phone", wch: 22 },
  { key: "email", header: "Email", wch: 34 },
  { key: "website", header: "Website", wch: 46 },
  { key: "maps_url", header: "Map / Profile URL", wch: 46 },
];

/**
 * Downloads the given campaign results as an Excel (.xlsx) file,
 * using the SheetJS `xlsx` library entirely in the browser.
 *
 * @param {object[]} results   Array of business/author rows (from the API)
 * @param {string}   filename  e.g. "campaign_results.xlsx"
 */
export function exportResultsToExcel(results, filename = "results.xlsx") {
  if (!results || results.length === 0) return;

  // 1. Shape rows into an array-of-arrays with a leading header row so we
  //    fully control column order + headers.
  const data = [
    COLUMNS.map((c) => c.header), // header row
    ...results.map((r) => COLUMNS.map((c) => r[c.key] ?? "")),
  ];

  // 2. Build worksheet + workbook from the 2D array.
  const ws = XLSX.utils.aoa_to_sheet(data);

  // 3. Apply column widths from our definitions.
  ws["!cols"] = COLUMNS.map((c) => ({ wch: c.wch }));

  // 4. Assemble the workbook.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  // 5. writeFile triggers a browser download using the HTML5 download attr.
  XLSX.writeFile(wb, filename);
}

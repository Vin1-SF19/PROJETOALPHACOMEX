import "server-only";
import { protectCsvCell, type CsvCell } from "./csv";

export const GOOGLE_SHEETS_NEW_URL = "https://sheets.new";

function tsvCell(value: CsvCell): string {
  return protectCsvCell(value).replace(/[\t\r\n]+/g, " ");
}

/** Mirrors OpenSEO: copy a safe TSV table, then let the user paste into sheets.new. */
export function createGoogleSheetsClipboard(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  return [headers, ...rows].map((row) => row.map(tsvCell).join("\t")).join("\r\n");
}

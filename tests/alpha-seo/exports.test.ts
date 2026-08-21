import { describe, expect, it } from "vitest";
import { createCsv, protectCsvCell } from "@/lib/alpha-seo/exports/csv";
import { createGoogleSheetsClipboard, GOOGLE_SHEETS_NEW_URL } from "@/lib/alpha-seo/exports/google-sheets";

describe("Alpha SEO exports", () => {
  it.each(["=2+2", "+cmd", "-10+20", "@SUM(A1)", " \t=cmd", "\r\n+cmd"])(
    "neutralizes spreadsheet formula %s",
    (value) => expect(protectCsvCell(value)).toBe(`'${value}`),
  );
  it("quotes CSV cells and emits UTF-8 BOM", () =>
    expect(createCsv(["name"], [["a,b"], ["safe"]])).toBe(
      '\uFEFFname\r\n"a,b"\r\nsafe\r\n',
    ));
  it("creates a formula-safe paste payload for sheets.new", () => {
    expect(createGoogleSheetsClipboard(["name", "value"], [["alpha", "=2+2"]])).toBe(
      "name\tvalue\r\nalpha\t'=2+2",
    );
    expect(GOOGLE_SHEETS_NEW_URL).toBe("https://sheets.new");
  });
});

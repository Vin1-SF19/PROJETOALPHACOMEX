export type CsvCell = string | number | boolean | Date | null | undefined;

const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;
export function protectCsvCell(value: CsvCell): string {
  const text = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}
function quote(value: string): string { return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; }
export function createCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const line = (cells: readonly CsvCell[]) => cells.map((cell) => quote(protectCsvCell(cell))).join(",");
  return `\uFEFF${[line(headers), ...rows.map(line)].join("\r\n")}\r\n`;
}

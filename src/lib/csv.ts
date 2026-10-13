/** Escape a CSV cell and neutralize spreadsheet formula prefixes. */
export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/u.test(text) ? `'${text}` : text;
  return /[",\r\n]/u.test(safe) ? `"${safe.replace(/"/gu, '""')}"` : safe;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

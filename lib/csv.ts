// Shared CSV serialisation for the data-export ZIP (PRD section 4.10).
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))];
  return lines.join("\n");
}

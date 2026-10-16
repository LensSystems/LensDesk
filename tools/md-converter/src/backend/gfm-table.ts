export function toGfmTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const columns = Math.max(...rows.map((row) => row.length));
  const normalize = (row: string[]) =>
    Array.from({ length: columns }, (_, index) => escapeCell(row[index] ?? ""));
  const header = normalize(rows[0] ?? []);
  const divider = Array.from({ length: columns }, () => "---");
  return [header, divider, ...rows.slice(1).map(normalize)]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

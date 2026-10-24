import { searchHighlight } from "./search-highlight.ts";

export function noteSummary(body: string, _title: string, query = ""): string {
  const lines = body.split("\n").map((line) =>
    line
      .trim()
      .replace(/^[#*>`\s-]+/, "")
      .replace(/[*`#>]/g, "")
      .trim(),
  );
  if (query.trim())
    return (
      (query.trim()
        ? lines.find((line) => searchHighlight(line, query).some((span) => span.match))
        : undefined) ??
      lines.find((line) => line) ??
      ""
    );
  let fenced = false;
  let firstHeading = "";
  const summary: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced || !line) continue;
    if (line.startsWith("#")) {
      firstHeading ||= line.replace(/^#+\s*/, "").replace(/[*_`]/g, "");
      continue;
    }
    const text = line
      .replace(/^(?:(?:[-*]\s+(?:\[[ xX]\]\s*)?|\d+\.\s+|>\s*)|#+\s*)+/, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (text) summary.push(text);
  }
  return (summary.join(", ") || firstHeading).slice(0, 120);
}

import { searchHighlight } from "./search-highlight.ts";

export function noteSummary(body: string, title: string, query = ""): string {
  const lines = body.split("\n").map((line) =>
    line
      .trim()
      .replace(/^[#*>`\s-]+/, "")
      .replace(/[*`#>]/g, "")
      .trim(),
  );
  return (
    (query.trim()
      ? lines.find(
          (line) => line !== title && searchHighlight(line, query).some((span) => span.match),
        )
      : undefined) ??
    lines.find((line) => line && line !== title) ??
    ""
  );
}

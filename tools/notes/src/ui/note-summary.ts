export function noteSummary(body: string, title: string): string {
  return (
    body
      .split("\n")
      .map((line) =>
        line
          .trim()
          .replace(/^[#*>`\s-]+/, "")
          .replace(/[*`#>]/g, "")
          .trim(),
      )
      .find((line) => line && line !== title) ?? ""
  );
}

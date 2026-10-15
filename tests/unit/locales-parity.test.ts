import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const localeDirectories = [
  "apps/desktop/src/renderer/locales",
  "apps/desktop/src/main/locales",
  ...readdirSync("tools", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("tools", entry.name, "locales")),
];

function flatten(value: unknown, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      for (const [nestedKey, nestedValue] of flatten(child, prefix ? `${prefix}.${key}` : key)) {
        result.set(nestedKey, nestedValue);
      }
    }
  } else if (typeof value === "string") {
    result.set(prefix, value);
  }
  return result;
}

describe("locale pairs", () => {
  it("have matching non-empty keys", () => {
    for (const directory of localeDirectories) {
      const spanishPath = join(directory, "es.json");
      const englishPath = join(directory, "en.json");
      if (!existsSync(spanishPath) && !existsSync(englishPath)) continue;
      expect(existsSync(spanishPath) && existsSync(englishPath), directory).toBe(true);
      const spanish = flatten(JSON.parse(readFileSync(spanishPath, "utf8")));
      const english = flatten(JSON.parse(readFileSync(englishPath, "utf8")));
      expect([...spanish.keys()].sort(), directory).toEqual([...english.keys()].sort());
      expect(
        [...spanish.values(), ...english.values()].every((value) => value.trim() !== ""),
        directory,
      ).toBe(true);
    }
  });
});

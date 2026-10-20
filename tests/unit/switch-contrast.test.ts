import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const theme = readFileSync(resolve(root, "packages/sdk/src/theme.css"), "utf8");
const styles = readFileSync(resolve(root, "packages/ui/src/styles.css"), "utf8");
const component = readFileSync(resolve(root, "packages/ui/src/Switch.tsx"), "utf8");

function tokens(name: "dark" | "light"): Record<string, string> {
  const block = theme.match(new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/--ld-([\w-]+):\s*(#[\da-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  );
}

// Tailwind usa nombres cortos para algunos tokens (`text-muted` → `--ld-text-muted`).
const tailwindToToken: Record<string, string> = { muted: "text-muted" };

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = (hex.slice(1).match(/.{2}/g) ?? []).map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: string, second: string): number {
  const [light = 0, dark = 0] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function thumbToken(selector: string): string {
  const escaped = selector.replace(/[.:]/g, (char) => `\\${char}`);
  const block = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return block.match(/background:\s*var\(--ld-([\w-]+)\)/)?.[1] ?? "";
}

function trackToken(prefix: "" | "checked:"): string {
  const name = component.match(new RegExp(`\\s${prefix}bg-([\\w-]+)`))?.[1] ?? "";
  return tailwindToToken[name] ?? name;
}

describe("interruptor", () => {
  it.each(["dark", "light"] as const)(
    "el círculo se distingue de la pista (3:1) en ambos estados, tema %s",
    (name) => {
      const values = tokens(name);
      const states = [
        [thumbToken(".ld-switch::before"), trackToken("")],
        [thumbToken(".ld-switch:checked::before"), trackToken("checked:")],
      ];
      for (const [thumb = "", track = ""] of states) {
        const thumbColor = values[thumb];
        const trackColor = values[track];
        expect(thumbColor && trackColor, `${thumb} / ${track}`).toBeTruthy();
        expect(
          contrast(thumbColor ?? "", trackColor ?? ""),
          `${name}: ${thumb} sobre ${track}`,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );
});

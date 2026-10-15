import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const palette = {
  "--ld-bg": ["#0F1115", "#FFFFFF"],
  "--ld-surface": ["#171A21", "#F6F7F9"],
  "--ld-surface-raised": ["#1E222B", "#FFFFFF"],
  "--ld-border": ["#2A2F3A", "#D9DDE3"],
  "--ld-border-control": ["#9AA3B2", "#5B6472"],
  "--ld-text": ["#E6E8EC", "#16181D"],
  "--ld-text-muted": ["#9AA3B2", "#5B6472"],
  "--ld-accent": ["#4F8CFF", "#2563EB"],
  "--ld-accent-hover": ["#6BA0FF", "#1D4ED8"],
  "--ld-accent-fg": ["#0B1020", "#FFFFFF"],
  "--ld-success": ["#3FB950", "#1A7F37"],
  "--ld-warning": ["#D29922", "#9A6700"],
  "--ld-danger": ["#F85149", "#CF222E"],
} as const;

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const themes = ["dark", "light"] as const;

function declarations(theme: (typeof themes)[number]): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`))?.[1];
  if (!block) throw new Error(`Falta el tema ${theme}`);
  return Object.fromEntries(
    [...block.matchAll(/(--ld-[\w-]+):\s*(#[\da-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((part) => Number.parseInt(part, 16) / 255);
  if (!channels) throw new Error(`Color inválido: ${hex}`);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const r = linear[0];
  const g = linear[1];
  const b = linear[2];
  if (r === undefined || g === undefined || b === undefined)
    throw new Error(`Color inválido: ${hex}`);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  const lighter = values[0];
  const darker = values[1];
  if (lighter === undefined || darker === undefined)
    throw new Error("No se pudo calcular contraste");
  return (lighter + 0.05) / (darker + 0.05);
}

function tokenValue(values: Record<string, string>, name: string): string {
  const value = values[name];
  if (!value) throw new Error(`Falta el token ${name}`);
  return value;
}

describe("design tokens", () => {
  it("defines the exact palette for both themes", () => {
    for (const [themeIndex, theme] of themes.entries()) {
      const values = declarations(theme);
      expect(Object.keys(values).sort()).toEqual(Object.keys(palette).sort());
      for (const [token, colors] of Object.entries(palette)) {
        expect(tokenValue(values, token).toUpperCase()).toBe(colors[themeIndex]);
      }
    }
  });

  it("keeps required text contrast at WCAG AA", () => {
    const textTokens = [
      "--ld-text",
      "--ld-text-muted",
      "--ld-success",
      "--ld-warning",
      "--ld-danger",
    ] as const;
    for (const theme of themes) {
      const values = declarations(theme);
      for (const token of textTokens) {
        expect(
          contrast(tokenValue(values, token), tokenValue(values, "--ld-bg")),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(tokenValue(values, token), tokenValue(values, "--ld-surface")),
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(tokenValue(values, "--ld-accent-fg"), tokenValue(values, "--ld-accent")),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("disables global motion for reduced-motion preferences", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/animation:\s*none/);
    expect(css).toMatch(/transition:\s*none/);
    expect(css).toMatch(/transition:\s*none\s*!important/);
  });
});

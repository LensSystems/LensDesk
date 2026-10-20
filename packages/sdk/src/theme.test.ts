import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const palette = {
  "--ld-bg": ["#2A2F36", "#E9ECF0"],
  "--ld-surface": ["#323840", "#F5F6F8"],
  "--ld-surface-raised": ["#3B424B", "#FFFFFF"],
  "--ld-border": ["#49515B", "#D5DAE1"],
  "--ld-border-control": ["#8E98A3", "#7D8692"],
  "--ld-text": ["#EEF1F4", "#1C222A"],
  "--ld-text-muted": ["#B7C0CA", "#4F5966"],
  "--ld-accent": ["#79AFFE", "#2160EB"],
  "--ld-accent-hover": ["#8BBAFF", "#1D4ED8"],
  "--ld-accent-fg": ["#0A1E3F", "#FFFFFF"],
  "--ld-accent-soft": ["#2C3E5C", "#E3ECFD"],
  "--ld-accent-soft-fg": ["#BFD6FF", "#1E40AF"],
  "--ld-success": ["#6EDC8C", "#197B35"],
  "--ld-success-soft": ["#2E4A3A", "#E3F4E8"],
  "--ld-warning": ["#F2C66D", "#8A5A00"],
  "--ld-warning-soft": ["#4A4130", "#FBF1DC"],
  "--ld-warning-soft-fg": ["#F7D58E", "#6B4600"],
  "--ld-danger": ["#FF8C82", "#C42B1C"],
  "--ld-danger-soft": ["#4E3335", "#FCE8E6"],
  "--ld-danger-fg": ["#3B0A06", "#FFFFFF"],
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

  it("keeps text contrast at WCAG AA (4.5:1) on every surface and soft fill", () => {
    const textTokens = [
      "--ld-text",
      "--ld-text-muted",
      "--ld-accent",
      "--ld-success",
      "--ld-warning",
      "--ld-danger",
    ] as const;
    const grounds = ["--ld-bg", "--ld-surface", "--ld-surface-raised"] as const;
    const pairs = [
      ["--ld-accent-fg", "--ld-accent"],
      ["--ld-accent-fg", "--ld-accent-hover"],
      ["--ld-accent-soft-fg", "--ld-accent-soft"],
      ["--ld-text", "--ld-accent-soft"],
      ["--ld-success", "--ld-success-soft"],
      ["--ld-text", "--ld-success-soft"],
      ["--ld-warning-soft-fg", "--ld-warning-soft"],
      ["--ld-text", "--ld-warning-soft"],
      ["--ld-danger", "--ld-danger-soft"],
      ["--ld-text", "--ld-danger-soft"],
      ["--ld-danger-fg", "--ld-danger"],
    ] as const;
    for (const theme of themes) {
      const values = declarations(theme);
      for (const token of textTokens) {
        for (const ground of grounds) {
          expect(
            contrast(tokenValue(values, token), tokenValue(values, ground)),
            `${theme}: ${token} sobre ${ground}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const [text, fill] of pairs) {
        expect(
          contrast(tokenValue(values, text), tokenValue(values, fill)),
          `${theme}: ${text} sobre ${fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps control borders and the focus ring at 3:1 on every surface", () => {
    for (const theme of themes) {
      const values = declarations(theme);
      for (const token of ["--ld-border-control", "--ld-accent"] as const) {
        for (const ground of ["--ld-bg", "--ld-surface", "--ld-surface-raised"] as const) {
          expect(
            contrast(tokenValue(values, token), tokenValue(values, ground)),
            `${theme}: ${token} sobre ${ground}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("mantiene AA y foco 3:1 con el acento verde en ambos temas", () => {
    for (const theme of themes) {
      const block = css.split(`[data-theme="${theme}"][data-accent="green"] {`)[1]?.split("}")[0];
      expect(block).toBeDefined();
      const accent = Object.fromEntries(
        [...(block ?? "").matchAll(/(--ld-[\w-]+):\s*(#[\da-fA-F]{6})/g)].map((m) => [m[1], m[2]]),
      );
      expect(Object.keys(accent).sort()).toEqual(
        [
          "--ld-accent",
          "--ld-accent-hover",
          "--ld-accent-fg",
          "--ld-accent-soft",
          "--ld-accent-soft-fg",
        ].sort(),
      );
      const values = { ...declarations(theme), ...accent };
      for (const ground of ["--ld-bg", "--ld-surface", "--ld-surface-raised"]) {
        const ratio = contrast(tokenValue(values, "--ld-accent"), tokenValue(values, ground));
        expect(ratio, `${theme}: acento sobre ${ground}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio, `${theme}: foco sobre ${ground}`).toBeGreaterThanOrEqual(3);
      }
      for (const [text, fill] of [
        ["--ld-accent-fg", "--ld-accent"],
        ["--ld-accent-fg", "--ld-accent-hover"],
        ["--ld-accent-soft-fg", "--ld-accent-soft"],
        ["--ld-text", "--ld-accent-soft"],
      ] as const) {
        expect(
          contrast(tokenValue(values, text), tokenValue(values, fill)),
          `${theme}: ${text} sobre ${fill}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("defines radii, a shadow per theme, Manrope and a 14 px base", () => {
    for (const [token, value] of [
      ["--ld-radius-sm", "6px"],
      ["--ld-radius-md", "10px"],
      ["--ld-radius-lg", "14px"],
      ["--ld-radius-xl", "18px"],
    ] as const) {
      expect(css).toMatch(new RegExp(`${token}:\\s*${value};`));
    }
    for (const theme of themes) {
      const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`))?.[1];
      expect(block).toMatch(/--ld-shadow:\s*0 8px 24px rgb\(/);
    }
    expect(css).toMatch(/font-family:\s*"Manrope Variable"/);
    expect(css).toMatch(/body\s*\{\s*font-size:\s*14px;/);
  });

  it("disables global motion for reduced-motion preferences", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/animation:\s*none/);
    expect(css).toMatch(/transition:\s*none/);
    expect(css).toMatch(/transition:\s*none\s*!important/);
  });
});

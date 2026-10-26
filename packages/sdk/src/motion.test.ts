import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tailwind.css", import.meta.url), "utf8");
const theme = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

function block(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Falta ${selector}`);
  const opening = source.indexOf("{", start);
  let depth = 1;
  let end = opening + 1;
  for (; end < source.length && depth > 0; end++) {
    if (source[end] === "{") depth++;
    if (source[end] === "}") depth--;
  }
  expect(depth).toBe(0);
  return source.slice(opening + 1, end - 1);
}

const tokens = Object.fromEntries(
  [...theme.matchAll(/(--ld-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
);

function resolve(value: string): string {
  return value.replace(/var\((--ld-[\w-]+)\)/g, (_, name: string) => {
    const token = tokens[name];
    if (!token) throw new Error(`Falta ${name}`);
    return token;
  });
}

describe("animaciones de superposiciones", () => {
  it("usan 120-160 ms ease-out, sin hex y solo si no se pide reducir el movimiento", () => {
    const animations = [...css.matchAll(/animation:\s*([^;]+);/g)];
    expect(animations.length).toBeGreaterThanOrEqual(6);
    for (const animation of animations) {
      const resolved = resolve(animation[1] ?? "");
      expect(resolved).toMatch(/\b\d+ms ease-out$/);
      const ms = Number(resolved.match(/(\d+)ms/)?.[1]);
      expect(ms >= 120 && ms <= 160).toBe(true);
    }
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const utility of css.matchAll(/@utility ([\w-]+)/g)) {
      const content = block(css, `@utility ${utility[1]}`);
      const media = block(content, "@media (prefers-reduced-motion: no-preference)");
      expect(content.trim()).toBe(`@media (prefers-reduced-motion: no-preference) {${media}}`);
    }
  });

  it.each([
    ["--ld-motion-fast", "140ms"],
    ["--ld-motion", "150ms"],
    ["--ld-motion-slow", "160ms"],
    ["--ld-ease-out", "ease-out"],
  ])("define una sola vez %s con valor %s en la raíz", (name, value) => {
    expect(block(theme, ":root")).toContain(`${name}: ${value};`);
    expect([...`${theme}\n${css}`.matchAll(new RegExp(`${name}:`, "g"))]).toHaveLength(1);
  });

  it.each(["fade", "pop", "slide"])("ld-%s usa los tokens compartidos", (name) => {
    const animations = [...block(css, `@utility ld-${name}`).matchAll(/animation:\s*([^;]+);/g)];
    expect(animations).toHaveLength(2);
    expect(animations.map((match) => match[1])).toEqual([
      `ld-${name}-in var(--ld-motion-fast) var(--ld-ease-out)`,
      `ld-${name}-out var(--ld-motion-fast) var(--ld-ease-out)`,
    ]);
  });
});

describe("fotogramas reutilizables", () => {
  it.each([
    [
      "ld-check-draw",
      { from: "stroke-dashoffset: 1; opacity: 0;", to: "stroke-dashoffset: 0; opacity: 1;" },
    ],
    [
      "ld-text-out",
      {
        from: "opacity: 1; transform: translateY(0); filter: blur(0);",
        to: "opacity: 0; transform: translateY(-4px); filter: blur(2px);",
      },
    ],
    [
      "ld-text-in",
      {
        from: "opacity: 0; transform: translateY(4px); filter: blur(2px);",
        to: "opacity: 1; transform: translateY(0); filter: blur(0);",
      },
    ],
    [
      "ld-shake",
      {
        "0%": "transform: translateX(0);",
        "15%": "transform: translateX(-4px);",
        "35%": "transform: translateX(4px);",
        "55%": "transform: translateX(-3px);",
        "75%": "transform: translateX(3px);",
        "90%": "transform: translateX(-1px);",
        "100%": "transform: translateX(0);",
      },
    ],
  ])("define los valores de %s", (name, frames) => {
    const keyframes = block(css, `@keyframes ${name}`);
    for (const [step, declarations] of Object.entries(frames)) {
      expect(block(keyframes, step).trim().replace(/\s+/g, " ")).toBe(declarations);
    }
  });
});

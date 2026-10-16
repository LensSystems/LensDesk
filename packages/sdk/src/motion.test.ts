import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tailwind.css", import.meta.url), "utf8");

describe("animaciones de superposiciones", () => {
  it("usan 120-160 ms ease-out, sin hex y solo si no se pide reducir el movimiento", () => {
    const durations = [...css.matchAll(/animation:[^;]*?(\d+)ms ease-out/g)].map((m) =>
      Number(m[1]),
    );
    expect(durations.length).toBeGreaterThanOrEqual(6);
    for (const ms of durations) expect(ms >= 120 && ms <= 160).toBe(true);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const block of css.split("@utility ").slice(1))
      expect(block).toContain("prefers-reduced-motion: no-preference");
  });
});

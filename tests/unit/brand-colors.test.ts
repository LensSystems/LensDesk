import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { brandColors } from "../../apps/desktop/src/renderer/src/shell/brand-colors.ts";

describe("colores de marca", () => {
  it("mantiene los colores principales del SVG", () => {
    const svg = readFileSync(new URL("../../apps/desktop/build/icon.svg", import.meta.url), "utf8");
    expect(svg.match(/fill="#[A-F0-9]+"/g)).toEqual([
      `fill="${brandColors.blue}"`,
      `fill="${brandColors.white}"`,
      `fill="${brandColors.white}"`,
      `fill="${brandColors.white}"`,
      `fill="${brandColors.slate}"`,
      `fill="${brandColors.blue}"`,
    ]);
    expect(brandColors.green).toBe("#2F7D5B");
  });
});

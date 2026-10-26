import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("limita la transición y la escala con desenfoque a movimiento permitido", () => {
  const own = readFileSync("tools/md-converter/src/ui/styles.css", "utf8");
  expect(own).toContain('@import "@lensdesk/ui/styles.css"');
  const css = readFileSync("packages/ui/src/styles.css", "utf8");
  const motion = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)"));
  expect(motion).toContain("transition: width var(--ld-motion) var(--ld-ease-out)");
  expect(motion).toContain("transform: scale(0.6)");
  expect(motion).toContain("filter: blur(2px)");
  expect(motion).toContain("opacity: 0");
  expect(css.indexOf("[data-copy-motion]")).toBeGreaterThan(
    css.lastIndexOf("@media (prefers-reduced-motion: no-preference)"),
  );
  const tokens = readFileSync("packages/sdk/src/theme.css", "utf8");
  expect(tokens).toContain("--ld-motion: 150ms");
  expect(tokens).toContain("--ld-ease-out: ease-out");
});

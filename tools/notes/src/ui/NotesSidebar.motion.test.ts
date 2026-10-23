import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("desactiva la animación del menú salvo cuando se permite movimiento", () => {
  const css = readFileSync("tools/notes/src/ui/styles.css", "utf8");
  const sheet = new CSSStyleSheet();
  sheet.insertRule(css.match(/\.sidebar-overlay\[data-state\] \{[^}]+\}/)?.[0] ?? "", 0);
  sheet.insertRule(
    css.match(/@media \(prefers-reduced-motion: no-preference\) \{[^}]+\}\s*\}/)?.[0] ?? "",
    1,
  );
  const base = sheet.cssRules[0] as CSSStyleRule;
  const motion = sheet.cssRules[1] as CSSMediaRule;
  expect(base.style.animation).toBe("none");
  expect(motion.media.mediaText).toBe("(prefers-reduced-motion: no-preference)");
  const animated = motion.cssRules[0] as CSSStyleRule;
  expect(animated.selectorText).toBe('.sidebar-overlay[data-state="open"]');
  expect(animated.style.animation).toBe("notes-sidebar-in 160ms ease-out");
  // Con movimiento reducido solo se aplica la regla base, también durante el cierre.
  expect(base.selectorText).toBe(".sidebar-overlay[data-state]");
});

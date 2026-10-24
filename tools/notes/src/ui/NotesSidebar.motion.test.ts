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

it("reserva 324 px para el panel normal y 312 px para el menú", () => {
  const css = readFileSync("tools/notes/src/ui/styles.css", "utf8");
  const sheet = new CSSStyleSheet();
  for (const selector of [".notes-sidebar", ".note-list", ".sidebar-overlay"]) {
    const rule = css.split(`${selector} {`)[1]?.split("}")[0];
    sheet.insertRule(`${selector} {${rule}}`, sheet.cssRules.length);
  }
  const rules = Array.from(sheet.cssRules) as CSSStyleRule[];
  expect(rules.map((rule) => rule.style.width)).toEqual(["324px", "324px", "312px"]);
  expect(rules[1]?.style.padding).toBe("12px");
  expect(rules[2]?.style.padding).toBe("12px 12px 16px");
});

it("ajusta la barra y el hueco solo por debajo de 900 px de ventana", () => {
  const css = readFileSync("tools/notes/src/ui/styles.css", "utf8");
  const block = css.split("@media (width < 900px) {")[1];
  expect(block).toBeTruthy();
  const sheet = new CSSStyleSheet();
  for (const rule of block?.match(/[^{}]+\{[^{}]*\}/g) ?? []) {
    sheet.insertRule(rule, sheet.cssRules.length);
  }
  const [workspace, widths, rail] = Array.from(sheet.cssRules) as CSSStyleRule[];
  expect(workspace?.selectorText).toBe(".workspace");
  expect(workspace?.style.gap).toBe("8px");
  expect(widths?.selectorText).toBe(".notes-sidebar,\n  .sidebar-rail");
  expect(widths?.style.width).toBe("44px");
  expect(rail?.style.gap).toBe("4px");
  expect(rail?.style.padding).toBe("6px 0px");
  expect(rail?.style.borderWidth).toBe("0px");
});

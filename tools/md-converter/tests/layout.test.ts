import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("usa el mismo marco sin padding superior que Notas", () => {
  for (const [app, base] of [
    ["converter", new URL("../src/ui/", import.meta.url)],
    ["notes", new URL("../../notes/src/ui/", import.meta.url)],
  ] as const) {
    expect(readFileSync(new URL("App.tsx", base), "utf8")).toContain(`className="${app}-app"`);
    const css = readFileSync(new URL("styles.css", base), "utf8");
    expect(css.match(new RegExp(`\\.${app}-app\\s*\\{([^}]+)\\}`))?.[1]).toMatch(
      /padding:\s*0 12px 12px;/,
    );
  }
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const sdk = join(root, "packages/sdk");

// Nombres con los que las fuentes empaquetadas se registran de verdad (@font-face).
function registeredFamilies(): Set<string> {
  const imports = readFileSync(join(sdk, "src/fonts.css"), "utf8").matchAll(/@import "([^"]+)";/g);
  const families = new Set<string>();
  for (const [, pkg] of imports) {
    const css = readFileSync(join(sdk, "node_modules", `${pkg}/index.css`), "utf8");
    for (const [, family] of css.matchAll(/font-family:\s*'([^']+)'/g)) families.add(family ?? "");
  }
  return families;
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === "out") return [];
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const sources = [
  "packages/sdk/src",
  "packages/ui/src",
  "packages/ui/gallery",
  "apps/desktop/src/renderer",
  ...readdirSync(join(root, "tools")).map((tool) => `tools/${tool}/src/ui`),
].flatMap((dir) => {
  try {
    return cssFiles(join(root, dir));
  } catch {
    return [];
  }
});

describe("fuentes", () => {
  it("cada CSS pide primero una fuente empaquetada con su nombre registrado", () => {
    const families = registeredFamilies();
    expect([...families].sort()).toEqual(["JetBrains Mono Variable", "Manrope Variable"]);
    const declarations = sources.flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/(?:^|[;{\s])font(?:-family)?:\s*([^;]+);/g)].map(
        ([, value]) => ({ file, value: (value ?? "").replace(/\s+/g, " ").trim() }),
      ),
    );
    expect(declarations.length).toBeGreaterThan(0);
    for (const { file, value } of declarations) {
      if (/^(inherit|var\()/.test(value)) continue;
      const first = value.match(/"([^"]+)"|'([^']+)'/);
      const family = first?.[1] ?? first?.[2];
      expect(family && families.has(family), `${file}: ${value}`).toBe(true);
    }
  });
});

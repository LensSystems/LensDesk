import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const release = readFileSync(resolve(root, ".github/workflows/release.yml"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const workflows = `${ci}\n${release}`;

describe("documentación de CI y publicación", () => {
  test("los workflows usan pnpm, verifican en ambos sistemas y tienen versiones fijadas", () => {
    for (const command of [
      "pnpm install --frozen-lockfile",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm smoke",
    ]) {
      expect(workflows).toContain(command);
    }
    expect(workflows).toContain("macos-latest");
    expect(workflows).toContain("windows-latest");
    expect(workflows).not.toMatch(/(?<![p])\bnpm\b/);
    expect(workflows).not.toMatch(/\bnpx\b/);
    expect(workflows).toContain("actions/checkout@v7.0.1");
    expect(workflows).toContain("pnpm/action-setup@v6.1.0");
    expect(workflows).toContain("actions/setup-node@v7.1.0");
    expect(workflows).toContain("actions/upload-artifact@v7.0.2");
  });

  test("el workflow de publicación firma solo las herramientas publicadas", () => {
    expect(release).toMatch(/tags:\s*\n\s*-\s*["']?v\*\.\*\*?["']?/);
    expect(release.match(/secrets\.LENSPKG_SIGNING_KEY/g)).toHaveLength(1);
    expect(release).toContain("tools/notes/dist");
    expect(release).toContain("tools/md-converter/dist");
    expect(release).toContain("softprops/action-gh-release@v3.0.3");
  });

  test("el README incluye ambos idiomas, instrucciones de instalación y desarrollo", () => {
    const englishHeading = "# LensDesk (English)";
    const spanish = readme.slice(0, readme.indexOf(englishHeading));
    const english = readme.slice(readme.indexOf(englishHeading));
    expect(readme).toContain(englishHeading);
    for (const [section, smartScreenSteps] of [
      [spanish, /SmartScreen[\s\S]*Más información[\s\S]*Ejecutar de todas formas/],
      [english, /SmartScreen[\s\S]*More info[\s\S]*Run anyway/],
    ] as const) {
      expect(section).toContain("xattr -dr com.apple.quarantine /Applications/LensDesk.app");
      expect(section).toMatch(smartScreenSteps);
      expect(section).toMatch(/Agregar herramienta|Add Tool/);
      expect(section).toContain("tools/_template");
      expect(section).toContain("pnpm install");
    }
    expect(readme).not.toMatch(/(?<![p])\bnpm\b/);
    expect(readme).not.toMatch(/\bnpx\b/);
  });
});

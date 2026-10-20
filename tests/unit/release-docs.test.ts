import { existsSync, readFileSync } from "node:fs";
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

  test("las sumas de verificación usan solo el nombre de cada archivo publicado", () => {
    const step = release.slice(release.indexOf("name: Generate checksums"));
    expect(step).toContain('shasum -a 256 "$(basename "$file")"');
    expect(step).not.toMatch(/xargs shasum/);
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
      expect(section).toMatch(/Agregar herramienta|Add tool/);
      expect(section).toContain("tools/_template");
      expect(section).toContain("pnpm install");
    }
    expect(readme).not.toMatch(/(?<![p])\bnpm\b/);
    expect(readme).not.toMatch(/\bnpx\b/);
  });

  test("la app tiene una sola versión y el CHANGELOG la documenta", () => {
    const version = (path: string) =>
      (JSON.parse(readFileSync(resolve(root, path), "utf8")) as { version: string }).version;
    const app = version("package.json");
    expect(version("apps/desktop/package.json")).toBe(app);
    for (const tool of ["notes", "md-converter"]) {
      expect(version(`tools/${tool}/lensdesk.tool.json`)).toBe(
        version(`tools/${tool}/package.json`),
      );
    }
    const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
    expect(changelog).toContain(`## [${app}] - `);
    expect(changelog).toContain(`[${app}]: https://github.com/LensSystems/LensDesk/`);
  });

  test("las imágenes que enlaza el README existen", () => {
    const images = [...readme.matchAll(/(?:src|srcset)="(docs\/images\/[^"]+)"/g)].map(
      (match) => match[1] as string,
    );
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(existsSync(resolve(root, image)), image).toBe(true);
  });
});

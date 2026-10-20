import { readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function forbiddenImports(source: string, file: string, root: string): string[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  function visit(node: ts.Node) {
    let specifier: string | undefined;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifier = node.moduleSpecifier.text;
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifier = node.arguments[0].text;
    }
    if (specifier) {
      const destination = relative(root, resolve(dirname(file), specifier));
      if (
        /^(electron(?:\/|$)|node:|react-i18next(?:\/|$)|i18next(?:\/|$))/.test(specifier) ||
        /(?:^|[/\\])(apps|tools)(?:[/\\]|$)/.test(specifier) ||
        (specifier.startsWith(".") &&
          (/^\.\.(?:[/\\]|$)/.test(destination) || isAbsolute(destination)))
      )
        violations.push(specifier);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return violations;
}

const root = import.meta.dirname;
describe("límites del paquete de interfaz", () => {
  it("mantiene todos los módulos dentro de los límites", () => {
    // Las pruebas se ejecutan en Node y quedan fuera: solo se revisa el código del paquete.
    for (const name of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
      const file = resolve(root, name);
      expect(forbiddenImports(readFileSync(file, "utf8"), file, root), name).toEqual([]);
    }
  });

  it.each([
    'import "electron";',
    'export { readFile } from "node:fs";',
    'import { useTranslation } from "react-i18next";',
    'import i18n from "i18next";',
    'import "../../apps/desktop/index.ts";',
    'import "../../tools/notes/index.ts";',
    'import "../outside.ts";',
    'const value = import("electron");',
    'const value = require("node:path");',
  ])("rechaza %s", (source) => {
    expect(forbiddenImports(source, resolve(root, "example.ts"), root)).toHaveLength(1);
  });

  it("admite módulos locales y dependencias de interfaz", () => {
    expect(
      forbiddenImports(
        'import "./Button.tsx"; export * from "react";',
        resolve(root, "example.ts"),
        root,
      ),
    ).toEqual([]);
  });
});

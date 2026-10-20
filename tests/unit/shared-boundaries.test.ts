import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const shared = resolve(import.meta.dirname, "../../apps/desktop/src/shared");
const renderer = resolve(shared, "../renderer/src");

function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const bindings = clause?.namedBindings;
      const exports = ts.isExportDeclaration(node) ? node.exportClause : undefined;
      const typeOnly =
        clause?.isTypeOnly ||
        (ts.isExportDeclaration(node) && node.isTypeOnly) ||
        (bindings &&
          ts.isNamedImports(bindings) &&
          !clause?.name &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly)) ||
        (exports &&
          ts.isNamedExports(exports) &&
          exports.elements.length > 0 &&
          exports.elements.every((item) => item.isTypeOnly));
      if (!typeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
        imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) imports.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

function isShared(file: string): boolean {
  const path = relative(shared, file);
  return path !== ".." && !path.startsWith("../") && !path.startsWith("/");
}

it("los módulos shared usados por el renderer solo importan otros módulos shared en ejecución", () => {
  const pending = new Set<string>();
  for (const name of readdirSync(renderer, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(name) || /\.(test|spec)\.tsx?$/.test(name)) continue;
    const file = resolve(renderer, name);
    for (const specifier of runtimeImports(file)) {
      const target = resolve(dirname(file), specifier);
      if (specifier.startsWith(".") && isShared(target)) pending.add(target);
    }
  }
  expect(pending.size).toBeGreaterThan(0);
  const visited = new Set<string>();
  for (const file of pending) {
    if (visited.has(file)) continue;
    visited.add(file);
    for (const specifier of runtimeImports(file)) {
      const target = resolve(dirname(file), specifier);
      expect(
        specifier.startsWith(".") && isShared(target),
        `${relative(shared, file)} importa en ejecución ${specifier}`,
      ).toBe(true);
      pending.add(target);
    }
  }
});

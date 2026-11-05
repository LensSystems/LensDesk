import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(".github/workflows/release-tool.yml"), "utf8");
const appRelease = readFileSync(resolve(".github/workflows/release.yml"), "utf8");

describe("workflow de publicación independiente", () => {
  it("compila y prueba ambos sistemas sin generar instaladores", () => {
    expect(workflow).toContain("os: [macos-latest, windows-latest]");
    for (const command of [
      "pnpm install --frozen-lockfile",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
    ])
      expect(workflow).toContain(command);
    expect(workflow).toContain('pnpm --dir "$TOOL_DIRECTORY" build');
    expect(workflow).not.toMatch(/pnpm dist|electron-builder|Build installers/);
    expect(workflow).not.toContain("tools/notes");
    expect(workflow).not.toContain("tools/md-converter");
  });

  it("requiere fuente integrada, firma después de compuertas y publica artefacto ya verificado", () => {
    expect(workflow).toContain(
      'git merge-base --is-ancestor "$GITHUB_SHA" refs/remotes/origin/main',
    );
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toMatch(/sign:\s*\n\s*needs: verify/);
    expect(workflow).toMatch(/publish:\s*\n\s*needs: sign/);
    expect(workflow.match(/secrets\.LENSPKG_SIGNING_KEY/g)).toHaveLength(1);
    expect(workflow).toContain("environment: tool-releases");
    expect(workflow).not.toMatch(/\$\{\{ github\.ref_name \}\}/);
    expect(workflow).toContain("tool-release-cli.ts dry-run");
    expect(workflow).toContain("catalog_release_tag:");
    for (const match of workflow.matchAll(/uses:\s*(\.\/\.github\/workflows\/[^\s]+)/g))
      expect(existsSync(resolve(match[1] ?? ""))).toBe(true);
  });

  it("separa grupos de publicación por tag y excluye tags de herramientas del workflow de app", () => {
    expect(workflow).toMatch(/group: tool-release-\$\{\{ github\.ref \}\}/);
    expect(workflow).toContain("cancel-in-progress: false");
    expect(appRelease).toContain('"!*-v*"');
    for (const id of ["notes", "md-converter", "viewer", "v1-tool"])
      expect(`${id}-v1.2.3`).toMatch(/-v/);
    expect("v0.5.0").not.toMatch(/-v/);
  });
});

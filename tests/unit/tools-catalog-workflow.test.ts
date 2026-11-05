import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(resolve(".github/workflows/tools-catalog.yml"), "utf8");
const tool = readFileSync(resolve(".github/workflows/release-tool.yml"), "utf8");
const app = readFileSync(resolve(".github/workflows/release.yml"), "utf8");

describe("catálogo reconstruible y snapshots en workflows", () => {
  it("serializa toda la ejecución antes de enumerar y solo publica el sitio generado", () => {
    expect(catalog.indexOf("concurrency:")).toBeLessThan(catalog.indexOf("jobs:"));
    expect(catalog).toContain("group: lensdesk-tools-catalog");
    expect(catalog).toContain("cancel-in-progress: false");
    expect(catalog).toContain("workflow_call:");
    expect(catalog).toContain("workflow_dispatch:");
    expect(catalog).toContain("ref: main");
    expect(catalog).toContain("tools-catalog-cli.ts build-site");
    expect(catalog).toContain("enablement: false");
    expect(catalog).toContain("path: catalog-site");
    expect(catalog).toMatch(/deploy:\s*\n\s*needs: build/);
    expect(catalog).toContain("pages: write");
    expect(catalog).toContain("id-token: write");
    expect(catalog).not.toMatch(/git (?:add|commit|push)|LENSPKG_SIGNING_KEY/);
  });

  it("encadena publicación y catálogo explícitamente sin depender de eventos recursivos", () => {
    for (const workflow of [tool, app]) {
      expect(workflow).toMatch(/catalog:\s*\n\s*needs: publish/);
      expect(workflow).toContain("uses: ./.github/workflows/tools-catalog.yml");
      expect(existsSync(resolve(".github/workflows/tools-catalog.yml"))).toBe(true);
    }
    expect(tool).toContain("needs.publish.outputs.published == 'true'");
    expect(catalog).not.toContain("release:");
    expect(app).toContain("tools-catalog-cli.ts snapshots");
    expect(app.indexOf("tools-catalog-cli.ts snapshots")).toBeLessThan(
      app.indexOf("name: Generate checksums"),
    );
    expect(app).not.toContain("Sign published tools");
    expect(app).not.toContain("LENSPKG_SIGNING_KEY");
    expect(app).toContain("pnpm dist");
    expect(tool).not.toContain("pnpm dist");
  });
});

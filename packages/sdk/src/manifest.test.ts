import { describe, expect, it } from "vitest";
import { MANIFEST_FILENAME, SUPPORTED_API_VERSIONS, toolManifestSchema } from "./manifest.ts";

const valid = {
  id: "sample-tool",
  name: { es: "Ejemplo", en: "Example" },
  description: { es: "Descripción", en: "Description" },
  version: "1.2.3",
  apiVersion: 1,
  icon: "sparkles",
  ui: { entry: "ui/index.html" },
  permissions: ["storage"],
  minHostVersion: "0.1.0",
};

describe("tool manifest", () => {
  it("exports stable filename and supported api versions", () => {
    expect(MANIFEST_FILENAME).toBe("lensdesk.tool.json");
    expect(SUPPORTED_API_VERSIONS).toEqual([1]);
    expect(toolManifestSchema.parse(valid)).toEqual(valid);
  });

  it("acepta un backend con el permiso backend", () => {
    const withBackend = {
      ...valid,
      backend: { entry: "backend/index.js" },
      permissions: ["storage", "files", "backend"],
    };
    expect(toolManifestSchema.safeParse(withBackend).success).toBe(true);
  });

  it.each([
    ["id pattern", { id: "1bad" }],
    ["name.es", { name: { es: " ", en: "Example" } }],
    ["name.en", { name: { es: "Ejemplo", en: "" } }],
    ["description.es", { description: { es: "", en: "Description" } }],
    ["description.en", { description: { es: "Descripción", en: " " } }],
    ["version semver", { version: "latest" }],
    ["integer apiVersion", { apiVersion: 1.5 }],
    ["nonempty icon", { icon: " " }],
    ["ui entry", { ui: { entry: "index.html" } }],
    ["backend entry", { backend: { entry: "backend/main.js" }, permissions: ["backend"] }],
    ["permission enum", { permissions: ["network"] }],
    ["duplicate permissions", { permissions: ["files", "files"] }],
    ["minHostVersion semver", { minHostVersion: "next" }],
    ["backend permission", { backend: { entry: "backend/index.js" }, permissions: [] }],
  ])("rejects invalid %s", (_field, change) => {
    expect(toolManifestSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

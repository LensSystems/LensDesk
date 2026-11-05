import { describe, expect, it } from "vitest";
import {
  OFFICIAL_TOOLS_REPOSITORY,
  type ToolReleaseMetadata,
  toolReleaseMetadataSchema,
} from "./contract.ts";
import { parseToolCatalog, parseToolReleaseMetadata, ToolCatalogValidationError } from "./parse.ts";
import { selectToolCatalogUpdates } from "./select.ts";

function release(id = "notes", minHostVersion = "0.1.0", bootstrap = false): ToolReleaseMetadata {
  const version = bootstrap ? "0.4.0" : "0.4.5";
  const releaseTag = bootstrap ? "v0.4.0" : `${id}-v${version}`;
  const base = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases`;
  return {
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    id,
    version,
    apiVersion: 1,
    minHostVersion,
    releaseTag,
    asset: {
      name: `${id}-${version}.lenspkg`,
      url: `${base}/download/${releaseTag}/${id}-${version}.lenspkg`,
      size: 1234,
      sha256: "a".repeat(64),
    },
    notesUrl: `${base}/tag/${releaseTag}`,
  };
}
const catalogJson = (releases: ToolReleaseMetadata[]) =>
  JSON.stringify({
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    generatedAt: "2026-11-04T12:00:00.000Z",
    releases,
  });

describe("compatibilidad semver con el manifiesto del SDK", () => {
  it.each(["v0.4.0", "0.4.0+build.7", "0.4.0-beta.1"])(
    "acepta una versión local válida %s sin perder actualizaciones de otras herramientas",
    (version) => {
      const installed = [
        { id: "notes", version },
        { id: "md-converter", version: "0.4.0" },
      ];
      const original = structuredClone(installed);
      const releases = [release(), release("md-converter")];
      const result = selectToolCatalogUpdates(
        parseToolCatalog(catalogJson(releases)),
        installed,
        "v0.5.0+host.7",
      );
      expect(result).toEqual({ updates: releases, incompatible: [] });
      expect(installed).toEqual(original);
    },
  );

  it.each(["v0.5.0", "0.5.0+build.7", "0.5.0-beta.2"])(
    "preserva la cadena de host mínimo válida %s del manifiesto",
    (minHostVersion) => {
      const metadata = release("notes", minHostVersion);
      expect(parseToolReleaseMetadata(JSON.stringify(metadata)).minHostVersion).toBe(
        minHostVersion,
      );
      expect(parseToolCatalog(catalogJson([metadata])).releases[0]?.minHostVersion).toBe(
        minHostVersion,
      );
    },
  );

  it("compara el mínimo prerelease sin convertirlo a estable", () => {
    const metadata = release("notes", "0.5.0-beta.2");
    const data = parseToolCatalog(catalogJson([metadata]));
    const installed = [{ id: "notes", version: "0.4.0" }];
    expect(selectToolCatalogUpdates(data, installed, "0.5.0-beta.2")).toEqual({
      updates: [metadata],
      incompatible: [],
    });
    expect(selectToolCatalogUpdates(data, installed, "0.5.0-beta.1")).toEqual({
      updates: [],
      incompatible: [{ release: metadata, reasons: ["minHostVersion"] }],
    });
    expect(selectToolCatalogUpdates(data, installed, "0.5.0").updates).toEqual([metadata]);
  });

  it.each(["bad", "0.5", "0.4.0-01", "x".repeat(257)])(
    "rechaza bootstrap con mínimo inválido %j sin filtrar TypeError de semver",
    (minimum) => {
      const metadata = release("notes", minimum, true);
      expect(() => toolReleaseMetadataSchema.safeParse(metadata)).not.toThrow();
      expect(toolReleaseMetadataSchema.safeParse(metadata).success).toBe(false);
      expect(() => parseToolReleaseMetadata(JSON.stringify(metadata))).toThrow(
        ToolCatalogValidationError,
      );
      expect(() => parseToolCatalog(catalogJson([metadata]))).toThrow(ToolCatalogValidationError);
    },
  );

  it("admite bootstrap con mínimo normalizable y rechaza mínimo posterior incompatible", () => {
    const metadata = release("notes", "v0.4.0+legacy.1", true);
    expect(parseToolReleaseMetadata(JSON.stringify(metadata))).toEqual(metadata);
    expect(() =>
      parseToolReleaseMetadata(JSON.stringify(release("notes", "0.4.1-beta.1", true))),
    ).toThrow(ToolCatalogValidationError);
  });
});

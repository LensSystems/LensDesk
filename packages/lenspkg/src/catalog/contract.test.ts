import { describe, expect, it } from "vitest";
import {
  OFFICIAL_TOOLS_CATALOG_URL,
  OFFICIAL_TOOLS_REPOSITORY,
  TOOL_CATALOG_LIMITS,
  type ToolReleaseMetadata,
  toolsCatalogUrl,
} from "./contract.ts";
import { parseToolCatalog, parseToolReleaseMetadata, ToolCatalogValidationError } from "./parse.ts";
import { selectToolCatalogUpdates } from "./select.ts";

function entry(id = "notes", version = "0.4.5", changes = {}): ToolReleaseMetadata {
  const tag = `${id}-v${version}`;
  return {
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    id,
    version,
    apiVersion: 1,
    minHostVersion: "0.1.0",
    releaseTag: tag,
    asset: {
      name: `${id}-${version}.lenspkg`,
      url: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/download/${tag}/${id}-${version}.lenspkg`,
      size: 1234,
      sha256: "a".repeat(64),
    },
    notesUrl: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/tag/${tag}`,
    ...changes,
  };
}
function catalog(releases: unknown[], changes = {}) {
  return {
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    generatedAt: "2026-11-04T12:00:00.000Z",
    releases,
    ...changes,
  };
}
const parse = (releases: unknown[], changes = {}) =>
  parseToolCatalog(JSON.stringify(catalog(releases, changes)));
const installed = [{ id: "notes", version: "0.4.0" }];
const choose = (releases: ToolReleaseMetadata[]) =>
  selectToolCatalogUpdates(parse(releases), installed, "0.5.0");

function bootstrap(id: "notes" | "md-converter") {
  const release = entry(id, "0.4.0", { releaseTag: "v0.4.0" });
  release.asset.url = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/download/v0.4.0/${release.asset.name}`;
  release.notesUrl = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/tag/v0.4.0`;
  return release;
}

describe("contrato del catálogo de herramientas", () => {
  it("expone el contrato puro desde la entrada pública existente", async () => {
    const api = await import("../index.ts");
    expect(api.parseToolCatalog).toBe(parseToolCatalog);
    expect(api.parseToolReleaseMetadata).toBe(parseToolReleaseMetadata);
    expect(api.selectToolCatalogUpdates).toBe(selectToolCatalogUpdates);
    expect(api.TOOL_CATALOG_LIMITS).toEqual(TOOL_CATALOG_LIMITS);
  });

  it("vincula catálogo solo al mismo repositorio oficial", () => {
    expect(toolsCatalogUrl(OFFICIAL_TOOLS_REPOSITORY)).toBe(OFFICIAL_TOOLS_CATALOG_URL);
    expect(toolsCatalogUrl("lenssystems/lensdesk")).toBe(OFFICIAL_TOOLS_CATALOG_URL);
    for (const repo of ["", "Otro/LensDesk", " LensSystems/LensDesk", "LensSystems/LensDesk/"])
      expect(toolsCatalogUrl(repo)).toBeNull();
  });

  it("valida sidecar independiente y UTF-8 de un catálogo completo", () => {
    const release = entry();
    expect(parseToolReleaseMetadata(JSON.stringify(release))).toEqual(release);
    const data = new TextEncoder().encode(JSON.stringify(catalog([release])));
    expect(parseToolCatalog(data).releases).toEqual([release]);
  });

  it("permite los dos paquetes bootstrap sin renumerar ni republicar", () => {
    const releases = [bootstrap("notes"), bootstrap("md-converter")];
    expect(parse(releases).releases).toEqual(releases);
    expect(selectToolCatalogUpdates(parse(releases), installed, "0.4.0").updates).toEqual([]);
    const fake = bootstrap("notes");
    expect(() => parse([{ ...fake, apiVersion: 2 }])).toThrow();
    expect(() => parse([{ ...fake, minHostVersion: "0.5.0" }])).toThrow();
    expect(() => parse([{ ...fake, id: "new-tool" }])).toThrow();
  });

  it.each(["01.4.5", "v0.4.5", "0.4", "0.4.5-beta.1", "0.4.5+build", " 0.4.5", "0.4.5\n"])(
    "rechaza versión no estable/canónica %j",
    (version) => expect(() => parse([entry("notes", version)])).toThrow(),
  );

  it.each([
    { id: "../notes" },
    { version: "bad" },
    { apiVersion: 0 },
    { apiVersion: -1 },
    { apiVersion: 1.5 },
    { minHostVersion: "bad" },
    { minHostVersion: "0.5" },
    { releaseTag: "v0.5.0" },
    { schemaVersion: 2 },
    { repository: "Otro/Repo" },
    { extra: "unknown" },
  ])("rechaza metadatos inválidos %j", (change) => {
    expect(() => parse([entry("notes", "0.4.5", change)])).toThrow(ToolCatalogValidationError);
  });

  it.each([
    { schemaVersion: 2 },
    { repository: "Otro/Repo" },
    { generatedAt: "ayer" },
    { generatedAt: "2026-11-04" },
    { extra: true },
  ])("rechaza catálogo inválido %j", (change) => {
    expect(() => parse([], change)).toThrow(ToolCatalogValidationError);
  });

  it.each([
    "http://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg",
    "https://github.com.evil.test/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg",
    "https://user@github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg",
    "https://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/%6eotes-0.4.5.lenspkg",
    "https://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/../notes-0.4.5.lenspkg",
    "https://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg?q=x",
    "https://github.com/LensSystems/LensDesk/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg#x",
    "https://github.com/Otro/Repo/releases/download/notes-v0.4.5/notes-0.4.5.lenspkg",
    "javascript:alert(1)",
  ])("rechaza enlace de asset no autorizado %j", (url) => {
    const release = entry();
    release.asset.url = url;
    expect(() => parse([release])).toThrow();
  });

  it("no admite nombre, suma, tamaño o enlace de novedades ajenos", () => {
    for (const asset of [
      { name: "other-0.4.5.lenspkg" },
      { sha256: "A".repeat(64) },
      { sha256: "z".repeat(64) },
      { size: 0 },
      { size: TOOL_CATALOG_LIMITS.packageBytes + 1 },
      { size: 1.5 },
      { extra: true },
    ]) {
      const release = entry();
      Object.assign(release.asset, asset);
      expect(() => parse([release])).toThrow();
    }
    expect(() => parse([entry("notes", "0.4.5", { notesUrl: "https://evil.test" })])).toThrow();
    const largest = entry();
    largest.asset.size = TOOL_CATALOG_LIMITS.packageBytes;
    expect(parse([largest]).releases).toEqual([largest]);
  });

  it("conserva duplicados idénticos una vez y rechaza una versión con contenido conflictivo", () => {
    const release = entry();
    expect(parse([release, structuredClone(release)]).releases).toEqual([release]);
    const changed = structuredClone(release);
    changed.asset.sha256 = "b".repeat(64);
    expect(() => parse([release, changed])).toThrow(/Conflicting/);
    expect(() => parse([bootstrap("notes"), entry("notes", "0.4.0")])).toThrow(/Conflicting/);
  });

  it("mide bytes UTF-8 antes de parsear y admite el límite exacto", () => {
    for (const [read, value, limit] of [
      [parseToolCatalog, catalog([]), TOOL_CATALOG_LIMITS.catalogBytes],
      [parseToolReleaseMetadata, entry(), TOOL_CATALOG_LIMITS.metadataBytes],
    ] as const) {
      const json = JSON.stringify(value);
      expect(() => read(json.padEnd(limit, " "))).not.toThrow();
      expect(() => read(json.padEnd(limit + 1, " "))).toThrow(/byte limit/);
      const nonAscii = `"${"é".repeat(limit / 2)}"`;
      expect(nonAscii.length).toBeLessThan(limit);
      expect(() => read(nonAscii)).toThrow(/byte limit/);
      expect(() => read(new Uint8Array(limit + 1))).toThrow(/byte limit/);
    }
  });

  it("rechaza UTF-8 mal formado, JSON roto y valores sin estructura", () => {
    for (const input of [new Uint8Array([0xff]), "{", "null", "[]", '"catalog"']) {
      expect(() => parseToolCatalog(input)).toThrow(ToolCatalogValidationError);
      expect(() => parseToolReleaseMetadata(input)).toThrow(ToolCatalogValidationError);
    }
  });

  it("limita las entradas totales antes de deduplicar, sin truncar", () => {
    const release = entry();
    expect(parse(Array(TOOL_CATALOG_LIMITS.entries).fill(release)).releases).toHaveLength(1);
    expect(() => parse(Array(TOOL_CATALOG_LIMITS.entries + 1).fill(release))).toThrow();
  });

  it("limita versiones por herramienta e IDs distintos, sin truncar", () => {
    const versions = Array.from({ length: TOOL_CATALOG_LIMITS.versionsPerTool }, (_, i) =>
      entry("notes", `1.0.${i}`),
    );
    expect(parse(versions).releases).toHaveLength(TOOL_CATALOG_LIMITS.versionsPerTool);
    expect(() => parse([...versions, entry("notes", "2.0.0")])).toThrow(/candidate limit/);
    const tools = Array.from({ length: TOOL_CATALOG_LIMITS.tools }, (_, i) => entry(`tool-${i}`));
    expect(parse(tools).releases).toHaveLength(TOOL_CATALOG_LIMITS.tools);
    expect(() => parse([...tools, entry("another-tool")])).toThrow(/tool or candidate limit/);
  });
});

describe("selección de versiones compatibles", () => {
  it("elige la mayor compatible sin depender del orden y conserva posterior incompatible", () => {
    const releases = [
      entry("notes", "0.6.0", { apiVersion: 2, minHostVersion: "0.6.0" }),
      entry("notes", "0.4.4"),
      entry("notes", "0.4.5"),
      entry("new-tool", "1.0.0"),
    ];
    const selected = choose(releases);
    expect(selected.updates.map((e) => e.version)).toEqual(["0.4.5"]);
    expect(selected.incompatible).toEqual([
      { release: releases[0], reasons: ["apiVersion", "minHostVersion"] },
    ]);
    expect(choose([...releases].reverse())).toEqual(selected);
  });

  it("admite API futura como candidata incompatible sin invalidar todo el catálogo", () => {
    const release = entry("notes", "1.0.0", { apiVersion: 2 });
    expect(choose([release])).toEqual({
      updates: [],
      incompatible: [{ release, reasons: ["apiVersion"] }],
    });
  });

  it("no anuncia downgrade, misma versión, herramienta no instalada o incompatible superada", () => {
    expect(choose([entry("notes", "0.4.0"), entry("notes", "0.3.0"), entry("new-tool")])).toEqual({
      updates: [],
      incompatible: [],
    });
    const selected = choose([
      entry("notes", "0.4.4", { minHostVersion: "0.6.0" }),
      entry("notes", "0.4.5"),
    ]);
    expect(selected.updates.map((e) => e.version)).toEqual(["0.4.5"]);
    expect(selected.incompatible).toEqual([]);
    expect(selectToolCatalogUpdates(parse([entry()]), [], "0.5.0")).toEqual({
      updates: [],
      incompatible: [],
    });
  });

  it("considera compatible el host mínimo exacto y reconcilia instalar/quitar", () => {
    const release = entry("notes", "0.5.0", { minHostVersion: "0.5.0" });
    expect(choose([release]).updates).toEqual([release]);
    expect(
      selectToolCatalogUpdates(parse([release]), [{ id: "notes", version: "0.5.0" }], "0.5.0"),
    ).toEqual({ updates: [], incompatible: [] });
  });

  it("rechaza versiones locales inválidas e IDs duplicados en lugar de comparar parcialmente", () => {
    const data = parse([entry()]);
    expect(() => selectToolCatalogUpdates(data, installed, "invalid")).toThrow();
    expect(() =>
      selectToolCatalogUpdates(data, [{ id: "notes", version: "invalid" }], "0.5.0"),
    ).toThrow();
    expect(() => selectToolCatalogUpdates(data, [...installed, ...installed], "0.5.0")).toThrow();
    expect(() =>
      selectToolCatalogUpdates(data, [{ id: "../notes", version: "0.4.0" }], "0.5.0"),
    ).toThrow();
  });
});

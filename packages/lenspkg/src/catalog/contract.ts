import semver from "semver";
import { z } from "zod";

export const OFFICIAL_TOOLS_REPOSITORY = "LensSystems/LensDesk";
export const OFFICIAL_TOOLS_CATALOG_URL =
  "https://lenssystems.github.io/LensDesk/tools-catalog-v1.json";

export const TOOL_CATALOG_LIMITS = Object.freeze({
  catalogBytes: 2 * 1024 * 1024,
  metadataBytes: 16 * 1024,
  entries: 2000,
  tools: 250,
  versionsPerTool: 100,
  packageBytes: 100 * 1024 * 1024,
  timeoutMs: 10_000,
});

const stableVersion = z
  .string()
  .max(64)
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .refine((value) => semver.valid(value) === value, "Invalid stable version");

const hostMinimumVersion = z
  .string()
  .max(256)
  .refine((value) => semver.valid(value) !== null, "Invalid minimum host version");

export const toolReleaseMetadataSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    repository: z.literal(OFFICIAL_TOOLS_REPOSITORY),
    id: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
    version: stableVersion,
    apiVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    minHostVersion: hostMinimumVersion,
    releaseTag: z.string().min(1).max(120),
    asset: z.strictObject({
      name: z.string().min(1).max(120),
      url: z.string().min(1).max(512),
      size: z.number().int().positive().max(TOOL_CATALOG_LIMITS.packageBytes),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    notesUrl: z.string().min(1).max(512),
  })
  .superRefine((entry, context) => {
    const independentTag = `${entry.id}-v${entry.version}`;
    const bootstrap =
      entry.releaseTag === "v0.4.0" &&
      entry.version === "0.4.0" &&
      (entry.id === "notes" || entry.id === "md-converter");
    const validHostMinimum = semver.valid(entry.minHostVersion);
    const assetName = `${entry.id}-${entry.version}.lenspkg`;
    const releaseRoot = `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases`;
    // Comparación exacta: no se aceptan credenciales, queries, fragmentos o escapes.
    // El consumidor HTTP debe rechazar redirecciones; el esquema no realiza peticiones.
    if (
      (!bootstrap && entry.releaseTag !== independentTag) ||
      (bootstrap &&
        (entry.apiVersion !== 1 ||
          (validHostMinimum !== null && semver.gt(validHostMinimum, "0.4.0")))) ||
      entry.asset.name !== assetName ||
      entry.asset.url !== `${releaseRoot}/download/${entry.releaseTag}/${assetName}` ||
      entry.notesUrl !== `${releaseRoot}/tag/${entry.releaseTag}`
    )
      context.addIssue({ code: "custom", message: "Release identity or URL mismatch" });
  });

export const toolCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  repository: z.literal(OFFICIAL_TOOLS_REPOSITORY),
  generatedAt: z.iso.datetime().max(32),
  releases: z.array(toolReleaseMetadataSchema).max(TOOL_CATALOG_LIMITS.entries),
});

export type ToolReleaseMetadata = z.infer<typeof toolReleaseMetadataSchema>;
export type ToolCatalog = z.infer<typeof toolCatalogSchema>;

export function toolsCatalogUrl(repository: string): string | null {
  return repository.toLowerCase() === OFFICIAL_TOOLS_REPOSITORY.toLowerCase()
    ? OFFICIAL_TOOLS_CATALOG_URL
    : null;
}

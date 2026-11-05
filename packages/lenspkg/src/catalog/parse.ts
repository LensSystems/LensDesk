import {
  TOOL_CATALOG_LIMITS,
  type ToolCatalog,
  type ToolReleaseMetadata,
  toolCatalogSchema,
  toolReleaseMetadataSchema,
} from "./contract.ts";

export class ToolCatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolCatalogValidationError";
  }
}

function parseJson(input: string | Uint8Array, limit: number): unknown {
  if (typeof input === "string" && input.length > limit)
    throw new ToolCatalogValidationError("JSON exceeds byte limit");
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  if (bytes.byteLength > limit) throw new ToolCatalogValidationError("JSON exceeds byte limit");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ToolCatalogValidationError("Invalid UTF-8 JSON");
  }
}

export function parseToolReleaseMetadata(input: string | Uint8Array): ToolReleaseMetadata {
  const result = toolReleaseMetadataSchema.safeParse(
    parseJson(input, TOOL_CATALOG_LIMITS.metadataBytes),
  );
  if (!result.success) throw new ToolCatalogValidationError("Invalid tool release metadata");
  return result.data;
}

export function parseToolCatalog(input: string | Uint8Array): ToolCatalog {
  const result = toolCatalogSchema.safeParse(parseJson(input, TOOL_CATALOG_LIMITS.catalogBytes));
  if (!result.success) throw new ToolCatalogValidationError("Invalid tool catalog");
  const releases = new Map<string, ToolReleaseMetadata>();
  const counts = new Map<string, number>();
  for (const release of result.data.releases) {
    const key = `${release.id}@${release.version}`;
    const previous = releases.get(key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(release))
        throw new ToolCatalogValidationError("Conflicting release for the same tool version");
      continue;
    }
    const count = (counts.get(release.id) ?? 0) + 1;
    counts.set(release.id, count);
    if (count > TOOL_CATALOG_LIMITS.versionsPerTool || counts.size > TOOL_CATALOG_LIMITS.tools)
      throw new ToolCatalogValidationError("Catalog exceeds tool or candidate limit");
    releases.set(key, release);
  }
  return { ...result.data, releases: [...releases.values()] };
}

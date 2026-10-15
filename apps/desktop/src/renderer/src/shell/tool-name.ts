import type { ToolSummary } from "../../../shared/host-channels.ts";

type LocalizedManifest = {
  name?: Partial<Record<"es" | "en", string>>;
  description?: Partial<Record<"es" | "en", string>>;
};

export function toolText(tool: ToolSummary, language: string | undefined) {
  const locale = language === "en" ? "en" : "es";
  const manifest = tool.manifest as LocalizedManifest;
  return {
    name: manifest.name?.[locale] ?? tool.id,
    description: manifest.description?.[locale] ?? "",
  };
}

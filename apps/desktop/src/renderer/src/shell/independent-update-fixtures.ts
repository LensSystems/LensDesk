import type {
  IncompatibleToolUpdate,
  ToolSummary,
  ToolUpdate,
  UpdateSources,
} from "../../../shared/host-channels.ts";
export const sampleTool = (id = "notes", version = "0.4.0"): ToolSummary => ({
  id,
  version,
  manifest: {
    name: {
      es: id === "notes" ? "Notas" : "Convertidor",
      en: id === "notes" ? "Notes" : "Converter",
    },
    description: { es: "Datos locales", en: "Local data" },
  },
  enabled: true,
  signed: true,
  keyId: "release",
  installedAt: "",
  updatedAt: "",
});
export const sampleUpdate = (id = "notes"): ToolUpdate => ({
  id,
  version: "0.4.5",
  url: `https://github.com/LensSystems/LensDesk/releases/download/${id}-v0.4.5/${id}-0.4.5.lenspkg`,
});
export const sampleBlocked = (api = false): IncompatibleToolUpdate => ({
  id: "notes",
  version: "0.6.0",
  apiVersion: api ? 2 : 1,
  minHostVersion: api ? "0.1.0" : "0.6.0",
  notesUrl: "https://github.com/LensSystems/LensDesk/releases/tag/notes-v0.6.0",
  reasons: [api ? "apiVersion" : "minHostVersion"],
});
export const sampleApp = {
  version: "0.5.1",
  html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.5.1",
};
export const sampleSources = (count = 0, app = false): UpdateSources => ({
  app: { status: "success", update: app ? sampleApp : null },
  tools: {
    status: "success",
    updates:
      count === 0
        ? []
        : count === 1
          ? [sampleUpdate()]
          : [sampleUpdate(), sampleUpdate("md-converter")],
    incompatible: [],
  },
});

// Internal host DTOs. Catalog information is advisory; installation still verifies packages.
export type ToolUpdate = { id: string; version: string; url: string };
export type IncompatibleToolUpdate = {
  id: string;
  version: string;
  apiVersion: number;
  minHostVersion: string;
  notesUrl: string;
  reasons: ("apiVersion" | "minHostVersion")[];
};
export type AppUpdateInfo = {
  version: string;
  html_url: string;
  installerUrl?: string;
};
export type UpdateSourceStatus = "success" | "error" | "not-checked";
export type UpdateSources = {
  app: { status: UpdateSourceStatus; update: AppUpdateInfo | null };
  tools: {
    status: UpdateSourceStatus;
    updates: ToolUpdate[];
    incompatible: IncompatibleToolUpdate[];
  };
};
export type UpdateCheckResult = (
  | { kind: "skipped" }
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "available"; version: string; url: string; installerUrl?: string }
) & {
  tools?: ToolUpdate[];
  incompatible?: IncompatibleToolUpdate[];
  sources?: UpdateSources;
};

import { OFFICIAL_TOOLS_REPOSITORY, type ToolReleaseMetadata } from "@lensdesk/lenspkg";
import { vi } from "vitest";
import type { UpdateHttpFetch } from "./network.ts";
import { createUpdateService } from "./update-service.ts";

export function catalogRelease(
  id = "notes",
  version = "0.4.5",
  minHostVersion = "0.1.0",
  apiVersion = 1,
): ToolReleaseMetadata {
  const releaseTag = `${id}-v${version}`;
  const name = `${id}-${version}.lenspkg`;
  return {
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    id,
    version,
    apiVersion,
    minHostVersion,
    releaseTag,
    asset: {
      name,
      url: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/download/${releaseTag}/${name}`,
      size: 10,
      sha256: "a".repeat(64),
    },
    notesUrl: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/tag/${releaseTag}`,
  };
}
export function catalogResponse(releases = [catalogRelease()]): Response {
  return Response.json({
    schemaVersion: 1,
    repository: OFFICIAL_TOOLS_REPOSITORY,
    generatedAt: "2026-11-04T12:00:00.000Z",
    releases,
  });
}
export function appResponse(version = "0.4.0"): Response {
  return Response.json({
    tag_name: `v${version}`,
    html_url: `https://github.com/${OFFICIAL_TOOLS_REPOSITORY}/releases/tag/v${version}`,
  });
}
export function updateFixture(
  repo = OFFICIAL_TOOLS_REPOSITORY,
  target: { platform?: string; arch?: string } = {},
) {
  type Reply = () => Response | Promise<Response>;
  const state: {
    enabled: boolean;
    lastCheckedAt: string | null;
    installed: { id: string; version: string }[];
    app: Reply;
    catalog: Reply;
  } = {
    enabled: true,
    lastCheckedAt: null,
    installed: [{ id: "notes", version: "0.4.0" }],
    app: () => appResponse(),
    catalog: () => catalogResponse(),
  };
  const fetch = vi.fn<UpdateHttpFetch>((url) =>
    Promise.resolve(url.startsWith("https://api.github.com/") ? state.app() : state.catalog()),
  );
  const emit = vi.fn();
  const emitTools = vi.fn();
  const emitChecked = vi.fn();
  const setLastCheckedAt = vi.fn((value: string) => {
    state.lastCheckedAt = value;
  });
  const service = createUpdateService({
    ...target,
    repo,
    currentVersion: "0.4.0",
    fetch,
    now: () => new Date("2026-11-04T12:00:00.000Z"),
    settings: {
      enabled: () => state.enabled,
      lastCheckedAt: () => state.lastCheckedAt,
      setLastCheckedAt,
    },
    installedTools: () => state.installed,
    emit,
    emitTools,
    emitChecked,
    log: vi.fn(),
  });
  return { state, fetch, emit, emitTools, emitChecked, setLastCheckedAt, service };
}

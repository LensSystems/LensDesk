import semver from "semver";
import type {
  HostEventPayloads,
  IncompatibleToolUpdate,
  ToolSummary,
  ToolUpdate,
  UpdateCheckResult,
  UpdateSources,
} from "../../../shared/host-channels.ts";

export type UpdateState = {
  update: HostEventPayloads["update.available"] | null;
  toolUpdates: ToolUpdate[];
  toolIncompatible: IncompatibleToolUpdate[];
  updateSources: UpdateSources | null;
  updateResult: UpdateCheckResult | null;
  updateChecking: boolean;
};
export const initialUpdateState = (): UpdateState => ({
  update: null,
  toolUpdates: [],
  toolIncompatible: [],
  updateSources: null,
  updateResult: null,
  updateChecking: false,
});
export function isOlderVersion(installed: string, announced: string): boolean {
  const current = semver.valid(installed);
  const candidate = semver.valid(announced);
  return current !== null && candidate !== null && semver.gt(candidate, current);
}
export function installedUpdates<T extends { id: string; version: string }>(
  updates: readonly T[],
  tools: readonly ToolSummary[],
): T[] {
  const installed = new Map(tools.map((tool) => [tool.id, tool.version]));
  const selected = new Map<string, T>();
  for (const candidate of updates) {
    const version = installed.get(candidate.id);
    if (!version || !isOlderVersion(version, candidate.version)) continue;
    const previous = selected.get(candidate.id);
    if (!previous || isOlderVersion(previous.version, candidate.version))
      selected.set(candidate.id, candidate);
  }
  return [...selected.values()];
}
export function applyUpdateSources(
  state: UpdateState,
  sources: UpdateSources,
): Partial<UpdateState> {
  return {
    updateSources: sources,
    update: sources.app.status === "success" ? sources.app.update : state.update,
    toolUpdates: sources.tools.updates,
    toolIncompatible: sources.tools.incompatible,
  };
}
export function uncheckedSources(state: UpdateState): UpdateSources {
  return {
    app: { status: "not-checked", update: state.update },
    tools: {
      status: "not-checked",
      updates: state.toolUpdates,
      incompatible: state.toolIncompatible,
    },
  };
}
export function applyUpdateResult(
  state: UpdateState,
  result: UpdateCheckResult,
): Partial<UpdateState> {
  if (result.sources) return { ...applyUpdateSources(state, result.sources), updateResult: result };
  const sources = uncheckedSources(state);
  if (result.kind !== "skipped") {
    sources.app.status = result.kind === "error" ? "error" : "success";
    if (result.kind === "none") sources.app.update = null;
    if (result.kind === "available")
      sources.app.update = {
        version: result.version,
        html_url: result.url,
        ...(result.installerUrl ? { installerUrl: result.installerUrl } : {}),
      };
    if (result.tools)
      sources.tools = {
        status: "success",
        updates: result.tools,
        incompatible: result.incompatible ?? [],
      };
  }
  return { ...applyUpdateSources(state, sources), updateResult: result };
}
export function reconcileUpdateTools(
  state: UpdateState,
  tools: ToolSummary[],
): Partial<UpdateState> {
  const updates = installedUpdates(state.toolUpdates, tools);
  const incompatible = installedUpdates(state.toolIncompatible, tools);
  return {
    toolUpdates: updates,
    toolIncompatible: incompatible,
    ...(state.updateSources
      ? {
          updateSources: {
            ...state.updateSources,
            tools: { ...state.updateSources.tools, updates, incompatible },
          },
        }
      : {}),
  };
}

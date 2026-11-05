import { selectToolCatalogUpdates, type ToolCatalog, toolsCatalogUrl } from "@lensdesk/lenspkg";
import type { HostEventPayloads } from "../../shared/host-channels.ts";
import type {
  UpdateCheckResult,
  UpdateSourceStatus,
  UpdateSources,
} from "../../shared/update-types.ts";
import type { UpdateHttpFetch } from "./network.ts";
import { CHECK_INTERVAL_MS, readAppUpdate, readToolsCatalog, validUpdateRepo } from "./sources.ts";

export function createUpdateService(options: {
  platform?: string;
  arch?: string;
  installedTools?: () => { id: string; version: string }[];
  emitTools?: (payload: HostEventPayloads["tools.updatesAvailable"]) => void;
  emitChecked?: (payload: HostEventPayloads["updates.checked"]) => void;
  repo: string;
  currentVersion: string;
  fetch: UpdateHttpFetch;
  now: () => Date;
  timeoutMs?: number;
  settings: {
    enabled(): boolean;
    lastCheckedAt(): string | null;
    setLastCheckedAt(value: string): void;
  };
  emit(payload: HostEventPayloads["update.available"]): void;
  log(message: string): void;
}) {
  let running: Promise<UpdateCheckResult> | null = null;
  let catalog: ToolCatalog | undefined;
  let app: UpdateSources["app"] = { status: "not-checked", update: null };
  let toolsStatus: UpdateSourceStatus = "not-checked";
  let previousTools: UpdateSources["tools"] = {
    status: "not-checked",
    updates: [],
    incompatible: [],
  };
  const catalogAssociated = toolsCatalogUrl(options.repo) !== null;

  function sources(skipped = false): UpdateSources {
    let tools = previousTools;
    if (catalog) {
      try {
        // Read installed versions now, never capture them before the remote requests.
        const selection = selectToolCatalogUpdates(
          catalog,
          options.installedTools?.() ?? [],
          options.currentVersion,
        );
        tools = {
          status: toolsStatus,
          updates: selection.updates.map((release) => ({
            id: release.id,
            version: release.version,
            url: release.asset.url,
          })),
          incompatible: selection.incompatible.map(({ release, reasons }) => ({
            id: release.id,
            version: release.version,
            apiVersion: release.apiVersion,
            minHostVersion: release.minHostVersion,
            notesUrl: release.notesUrl,
            reasons,
          })),
        };
        previousTools = tools;
      } catch {
        tools = { ...tools, status: "error" };
        options.log("Catalog compatibility selection failed");
      }
    }
    return {
      app: { ...app, ...(skipped ? { status: "not-checked" as const } : {}) },
      tools: {
        ...tools,
        ...(skipped || !catalogAssociated
          ? { status: "not-checked" as const }
          : { status: tools.status === "error" ? "error" : toolsStatus }),
      },
    };
  }
  function result(state: UpdateSources, skipped = false): UpdateCheckResult {
    const extra = {
      sources: state,
      tools: state.tools.updates,
      incompatible: state.tools.incompatible,
    };
    if (skipped) return { kind: "skipped", ...extra };
    if (state.app.status !== "success") return { kind: "error", ...extra };
    if (!state.app.update) return { kind: "none", ...extra };
    const { html_url, ...update } = state.app.update;
    return { kind: "available", ...update, url: html_url, ...extra };
  }
  function publish(state: UpdateSources) {
    options.emitTools?.({
      tools: state.tools.updates,
      incompatible: state.tools.incompatible,
      status: state.tools.status,
    });
    // An authoritative app 'none' is emitted too, allowing the shell to clear old notices.
    options.emitChecked?.({ sources: state });
  }
  async function check(): Promise<UpdateCheckResult> {
    const [appResponse, catalogResponse] = await Promise.allSettled([
      readAppUpdate(options),
      catalogAssociated ? readToolsCatalog(options) : Promise.resolve(null),
    ]);
    if (appResponse.status === "fulfilled") app = { status: "success", update: appResponse.value };
    else {
      app = { ...app, status: "error" };
      options.log("App update source failed");
    }
    if (!catalogAssociated) toolsStatus = "not-checked";
    else if (catalogResponse.status === "fulfilled" && catalogResponse.value) {
      catalog = catalogResponse.value;
      toolsStatus = "success";
    } else {
      toolsStatus = "error";
      options.log("Tools catalog source failed");
    }
    try {
      options.settings.setLastCheckedAt(options.now().toISOString());
    } catch {
      options.log("Could not save update check time");
    }
    const state = sources();
    if (state.app.status === "success" && state.app.update) options.emit(state.app.update);
    publish(state);
    return result(state);
  }
  return {
    run(force = false): Promise<UpdateCheckResult> {
      if (!options.settings.enabled() || !validUpdateRepo(options.repo))
        return Promise.resolve(result(sources(true), true));
      if (running) return running;
      const last = Date.parse(options.settings.lastCheckedAt() ?? "");
      if (!force && Number.isFinite(last) && options.now().getTime() - last < CHECK_INTERVAL_MS)
        // Do not cache skipped promises: a manual call in this microtask must still fetch.
        return Promise.resolve(result(sources(true), true));
      running = check().finally(() => {
        running = null;
      });
      return running;
    },
    // Install/remove uses the last complete catalog in RAM; it never initiates a GET.
    reconcile(): UpdateSources {
      const state = sources(!options.settings.enabled() || !validUpdateRepo(options.repo));
      publish(state);
      return state;
    },
  };
}

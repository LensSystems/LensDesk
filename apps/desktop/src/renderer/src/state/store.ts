import { create } from "zustand";
import type {
  HostBridge,
  HostEventPayloads,
  HostSettingKey,
  PendingDowngrade,
  ShellTab,
  ToolSummary,
} from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";

type SettingValues = {
  locale: "es" | "en";
  theme: "system" | "dark" | "light";
  accent: "blue" | "green";
  developerMode: boolean;
  updatesCheck: boolean;
};
export type ShellToast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  source?: string;
  closedToolId?: string;
};
// Máximo de avisos en cola: al superarlo se descarta el más antiguo.
const maxToasts = 3;
const toastKinds = ["success", "error", "info"] as const;
let nextToastId = 1;
type State = {
  fullScreen: boolean;
  tabs: ShellTab[];
  tools: ToolSummary[];
  toolUpdates: HostEventPayloads["tools.updatesAvailable"]["tools"];
  pendingDowngrade: PendingDowngrade | null;
  settings: SettingValues;
  context: HostEventPayloads["context.changed"];
  page: "tools" | "settings" | "tab";
  toasts: ShellToast[];
  update: HostEventPayloads["update.available"] | null;
  dismissedVersion: string | null;
  pushToast: (kind: ShellToast["kind"], message: string, source?: string) => void;
  removeToast: (id: number) => void;
  dismissUpdate: (bridge: HostBridge) => void;
  crashedToolId: string | null;
  showPage: (bridge: HostBridge, page: "tools" | "settings") => Promise<void>;
  hydrate: (bridge: HostBridge) => Promise<void>;
  subscribe: (bridge: HostBridge) => () => void;
};

const defaults: SettingValues = {
  locale: "es",
  theme: "system",
  accent: "blue",
  developerMode: false,
  updatesCheck: false,
};
// Cuenta los eventos recibidos por campo: si uno llega mientras hydrate espera, su dato es más
// reciente que la respuesta de hydrate y no se pisa.
const eventCounts = { tabs: 0, settings: 0, context: 0, fullScreen: 0 };
// Compara x.y.z (sin preversiones; la anunciada siempre es x.y.z).
function isOlderVersion(installed: string, announced: string): boolean {
  const parse = (value: string) => value.split(/[-+]/)[0]?.split(".").map(Number) ?? [];
  const [a, b] = [parse(installed), parse(announced)];
  for (let index = 0; index < 3; index++) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}

export const useShellStore = create<State>((set, get) => ({
  fullScreen: false,
  tabs: [],
  tools: [],
  toolUpdates: [],
  pendingDowngrade: null,
  settings: defaults,
  context: { locale: "es", theme: "dark", accent: "blue" },
  page: "tools",
  toasts: [],
  update: null,
  dismissedVersion: null,
  crashedToolId: null,
  pushToast(kind, message, source) {
    set((state) => ({
      toasts: [...state.toasts, { id: nextToastId++, kind, message, source }].slice(-maxToasts),
    }));
  },
  removeToast(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  dismissUpdate(bridge) {
    const version = useShellStore.getState().update?.version;
    set({ update: null, ...(version ? { dismissedVersion: version } : {}) });
    if (version)
      void bridge.invoke("settings.set", { key: "updates.dismissedVersion", value: version });
  },
  async showPage(bridge, page) {
    const result = await bridge.invoke("shell.showPage", { page });
    if (result.ok) set({ page: result.data.page });
  },
  async hydrate(bridge) {
    const before = { ...eventCounts };
    const [
      info,
      tabs,
      locale,
      theme,
      developerMode,
      updatesCheck,
      context,
      tools,
      dismissed,
      accent,
    ] = await Promise.all([
      bridge.invoke("app.getInfo", {}),
      bridge.invoke("tabs.list", {}),
      bridge.invoke("settings.get", { key: "locale" }),
      bridge.invoke("settings.get", { key: "theme" }),
      bridge.invoke("settings.get", { key: "developerMode" }),
      bridge.invoke("settings.get", { key: "updates.check" }),
      bridge.invoke("app.getContext", {}),
      bridge.invoke("tools.list", {}),
      bridge.invoke("settings.get", { key: "updates.dismissedVersion" }),
      bridge.invoke("settings.get", { key: "accent" }),
    ]);
    const dismissedVersion =
      dismissed.ok &&
      dismissed.data.key === "updates.dismissedVersion" &&
      typeof dismissed.data.value === "string"
        ? dismissed.data.value
        : null;
    const stale = (field: keyof typeof eventCounts) => eventCounts[field] !== before[field];
    set((state) => ({
      ...state,
      fullScreen: info.ok && !stale("fullScreen") ? info.data.fullScreen : state.fullScreen,
      ...(tabs.ok && !stale("tabs")
        ? {
            tabs: tabs.data.tabs,
            page: tabs.data.tabs.some((tab) => tab.active) ? ("tab" as const) : ("tools" as const),
          }
        : {}),
      settings: stale("settings")
        ? state.settings
        : {
            locale:
              locale.ok && (locale.data.value === "es" || locale.data.value === "en")
                ? locale.data.value
                : defaults.locale,
            theme:
              theme.ok &&
              (theme.data.value === "system" ||
                theme.data.value === "dark" ||
                theme.data.value === "light")
                ? theme.data.value
                : defaults.theme,
            accent: accent.ok && accent.data.value === "green" ? "green" : "blue",
            developerMode:
              developerMode.ok && typeof developerMode.data.value === "boolean"
                ? developerMode.data.value
                : defaults.developerMode,
            updatesCheck:
              updatesCheck.ok && typeof updatesCheck.data.value === "boolean"
                ? updatesCheck.data.value
                : defaults.updatesCheck,
          },
      dismissedVersion: dismissedVersion ?? state.dismissedVersion,
      update: dismissedVersion && state.update?.version === dismissedVersion ? null : state.update,
      context: context.ok && !stale("context") ? context.data : state.context,
      ...(tools.ok && Array.isArray(tools.data.tools)
        ? { tools: tools.data.tools, pendingDowngrade: tools.data.pendingDowngrade }
        : {}),
    }));
  },
  subscribe(bridge) {
    const unsubscribers = [
      bridge.on("window.fullScreenChanged", ({ fullScreen }) => {
        eventCounts.fullScreen += 1;
        set({ fullScreen });
      }),
      bridge.on("tabs.changed", ({ tabs }) => {
        eventCounts.tabs += 1;
        const { tabs: before, page } = get();
        // Solo reordenar (mismas pestañas y activa, otro orden) no saca de Herramientas ni de
        // Ajustes; activar la pestaña ya activa publica la misma lista y sí vuelve a ella.
        const entries = (list: typeof tabs) => list.map((tab) => `${tab.toolId}:${tab.active}`);
        const reordered =
          entries(before).join() !== entries(tabs).join() &&
          entries(before).sort().join() === entries(tabs).sort().join();
        if (page !== "tab" && reordered) set({ tabs });
        else set({ tabs, page: tabs.some((tab) => tab.active) ? "tab" : "tools" });
      }),
      bridge.on("settings.changed", ({ key, value }) => {
        eventCounts.settings += 1;
        if (key === "updates.dismissedVersion")
          set({ dismissedVersion: typeof value === "string" ? value : null });
        if (
          key === "locale" ||
          key === "theme" ||
          key === "accent" ||
          key === "developerMode" ||
          key === "updates.check"
        )
          set((state) => ({
            settings: {
              ...state.settings,
              [key === "updates.check" ? "updatesCheck" : key]: value,
            } as SettingValues,
          }));
      }),
      bridge.on("context.changed", (context) => {
        eventCounts.context += 1;
        set({ context });
      }),
      bridge.on("tabs.closedForLimit", ({ toolId }) => {
        set((state) => ({
          toasts: [
            ...state.toasts,
            { id: nextToastId++, kind: "info" as const, message: "", closedToolId: toolId },
          ].slice(-maxToasts),
        }));
      }),
      bridge.on("tools.changed", ({ tools, pendingDowngrade }) =>
        set((state) => ({
          tools,
          pendingDowngrade,
          // El aviso sigue mientras la versión instalada sea menor que la anunciada.
          toolUpdates: state.toolUpdates.filter((update) => {
            const tool = tools.find((tool) => tool.id === update.id);
            return !!tool && isOlderVersion(tool.version, update.version);
          }),
        })),
      ),
      bridge.on("tools.updatesAvailable", ({ tools }) => set({ toolUpdates: tools })),
      bridge.on("update.available", (update) =>
        set((state) => (update.version === state.dismissedVersion ? {} : { update })),
      ),
      bridge.on("tools.toast", ({ toolId, kind, message }) =>
        useShellStore
          .getState()
          .pushToast(
            (toastKinds as readonly string[]).includes(kind)
              ? (kind as ShellToast["kind"])
              : "info",
            message,
            toolId,
          ),
      ),
      bridge.on("app.error", () =>
        useShellStore.getState().pushToast("error", rendererI18n.t("shell.unexpectedError")),
      ),
      bridge.on("tool.crashed", ({ toolId }) => set({ crashedToolId: toolId })),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  },
}));

export type { HostSettingKey };

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
  developerMode: boolean;
  updatesCheck: boolean;
};
export type ShellToast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  source?: string;
};
// Máximo de avisos en cola: al superarlo se descarta el más antiguo.
const maxToasts = 3;
const toastKinds = ["success", "error", "info"] as const;
let nextToastId = 1;
type State = {
  tabs: ShellTab[];
  tools: ToolSummary[];
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
  developerMode: false,
  updatesCheck: false,
};
// Cuenta los eventos recibidos por campo: si uno llega mientras hydrate espera, su dato es más
// reciente que la respuesta de hydrate y no se pisa.
const eventCounts = { tabs: 0, settings: 0, context: 0 };
export const useShellStore = create<State>((set) => ({
  tabs: [],
  tools: [],
  pendingDowngrade: null,
  settings: defaults,
  context: { locale: "es", theme: "dark" },
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
    const [tabs, locale, theme, developerMode, updatesCheck, context, tools, dismissed] =
      await Promise.all([
        bridge.invoke("tabs.list", {}),
        bridge.invoke("settings.get", { key: "locale" }),
        bridge.invoke("settings.get", { key: "theme" }),
        bridge.invoke("settings.get", { key: "developerMode" }),
        bridge.invoke("settings.get", { key: "updates.check" }),
        bridge.invoke("app.getContext", {}),
        bridge.invoke("tools.list", {}),
        bridge.invoke("settings.get", { key: "updates.dismissedVersion" }),
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
      bridge.on("tabs.changed", ({ tabs }) => {
        eventCounts.tabs += 1;
        set({ tabs, page: tabs.some((tab) => tab.active) ? "tab" : "tools" });
      }),
      bridge.on("settings.changed", ({ key, value }) => {
        eventCounts.settings += 1;
        if (key === "updates.dismissedVersion")
          set({ dismissedVersion: typeof value === "string" ? value : null });
        if (
          key === "locale" ||
          key === "theme" ||
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
      bridge.on("tools.changed", ({ tools, pendingDowngrade }) => set({ tools, pendingDowngrade })),
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

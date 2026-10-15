import { create } from "zustand";
import type {
  HostBridge,
  HostEventPayloads,
  HostSettingKey,
  ShellTab,
} from "../../../shared/host-channels.ts";

type SettingValues = {
  locale: "es" | "en";
  theme: "system" | "dark" | "light";
  developerMode: boolean;
};
type State = {
  tabs: ShellTab[];
  tools: unknown[];
  settings: SettingValues;
  context: HostEventPayloads["context.changed"];
  page: "tools" | "settings" | "tab";
  toasts: unknown[];
  showPage: (bridge: HostBridge, page: "tools" | "settings") => Promise<void>;
  hydrate: (bridge: HostBridge) => Promise<void>;
  subscribe: (bridge: HostBridge) => () => void;
};

const defaults: SettingValues = { locale: "es", theme: "system", developerMode: false };
// Cuenta los eventos recibidos por campo: si uno llega mientras hydrate espera, su dato es más
// reciente que la respuesta de hydrate y no se pisa.
const eventCounts = { tabs: 0, settings: 0, context: 0 };
export const useShellStore = create<State>((set) => ({
  tabs: [],
  tools: [],
  settings: defaults,
  context: { locale: "es", theme: "dark" },
  page: "tools",
  toasts: [],
  async showPage(bridge, page) {
    const result = await bridge.invoke("shell.showPage", { page });
    if (result.ok) set({ page: result.data.page });
  },
  async hydrate(bridge) {
    const before = { ...eventCounts };
    const [tabs, locale, theme, developerMode, context] = await Promise.all([
      bridge.invoke("tabs.list", {}),
      bridge.invoke("settings.get", { key: "locale" }),
      bridge.invoke("settings.get", { key: "theme" }),
      bridge.invoke("settings.get", { key: "developerMode" }),
      bridge.invoke("app.getContext", {}),
    ]);
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
          },
      context: context.ok && !stale("context") ? context.data : state.context,
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
        if (key === "locale" || key === "theme" || key === "developerMode")
          set((state) => ({ settings: { ...state.settings, [key]: value } as SettingValues }));
      }),
      bridge.on("context.changed", (context) => {
        eventCounts.context += 1;
        set({ context });
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  },
}));

export type { HostSettingKey };

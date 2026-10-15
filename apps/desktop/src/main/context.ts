import type { HostEventPayloads, HostSettingKey } from "../shared/host-channels.ts";

export type ResolvedTheme = "dark" | "light";
export type AppContext = { locale: "es" | "en"; theme: ResolvedTheme };
type SettingsRepo = {
  get(key: HostSettingKey): unknown;
  set(key: HostSettingKey, value: unknown): void;
};
type ContextEvent = HostEventPayloads["context.changed"];

export function resolveTheme(setting: unknown, systemIsDark: boolean): ResolvedTheme {
  if (setting === "dark" || setting === "light") return setting;
  return systemIsDark ? "dark" : "light";
}

export function buildContext(input: {
  locale: unknown;
  themeSetting: unknown;
  systemIsDark: boolean;
}): AppContext {
  return {
    locale: input.locale === "en" ? "en" : "es",
    theme: resolveTheme(input.themeSetting, input.systemIsDark),
  };
}

export function createSettingsHandlers(options: {
  repo: SettingsRepo;
  emit: <E extends keyof HostEventPayloads>(event: E, payload: HostEventPayloads[E]) => void;
  getSystemIsDark: () => boolean;
}) {
  const getContext = (): AppContext => {
    const themeSetting = options.repo.get("theme");
    return buildContext({
      locale: options.repo.get("locale"),
      themeSetting,
      systemIsDark: themeSetting === "system" ? options.getSystemIsDark() : false,
    });
  };
  const contextPayload = (): ContextEvent => getContext();

  return {
    "settings.get": ({ key }: { key: HostSettingKey }) => ({ key, value: options.repo.get(key) }),
    "settings.set": ({ key, value }: { key: HostSettingKey; value: unknown }) => {
      options.repo.set(key, value);
      const setting = { key, value: options.repo.get(key) };
      options.emit("settings.changed", setting);
      if (key === "locale" || key === "theme") {
        options.emit("context.changed", contextPayload());
      }
      return setting;
    },
    "app.getContext": () => getContext(),
    emitContextChanged: () => options.emit("context.changed", contextPayload()),
  };
}

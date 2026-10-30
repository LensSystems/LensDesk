import { useCallback, useEffect, useRef, useState } from "react";
import type { HostBridge } from "../../../shared/host-channels.ts";

type SettingKey = "locale" | "theme" | "accent" | "developerMode";
export type SettingsAction = SettingKey | "info" | "folder";
export type SettingsActionState = {
  pending: boolean;
  error: boolean;
  retry: () => void;
};
type Operation = () => Promise<undefined | (() => void)>;

export function useSettingsActions(bridge: HostBridge) {
  const [states, setStates] = useState<Partial<Record<SettingsAction, SettingsActionState>>>({});
  const [info, setInfo] = useState<{ version: string; releasesRepo: string } | null>(null);
  const generation = useRef(0);
  const running = useRef(new Set<SettingsAction>());
  const run = useCallback(async function execute(id: SettingsAction, operation: Operation) {
    if (running.current.has(id)) return;
    const current = generation.current;
    running.current.add(id);
    setStates((previous) => ({
      ...previous,
      [id]: { pending: true, error: false, retry: () => void execute(id, operation) },
    }));
    let failed = false;
    try {
      const commit = await operation();
      if (current === generation.current) commit?.();
    } catch {
      failed = true;
    } finally {
      if (current === generation.current) {
        running.current.delete(id);
        setStates((previous) => ({
          ...previous,
          [id]: { pending: false, error: failed, retry: () => void execute(id, operation) },
        }));
      }
    }
  }, []);
  useEffect(() => {
    setInfo(null);
    setStates({});
    void run("info", async () => {
      const result = await bridge.invoke("app.getInfo", {});
      if (!result.ok) throw new Error("info");
      return () =>
        setInfo({ version: result.data.version, releasesRepo: result.data.releasesRepo ?? "" });
    });
    return () => {
      generation.current += 1;
      running.current.clear();
    };
  }, [bridge, run]);
  const update = (key: SettingKey, value: unknown) => {
    void run(key, async () => {
      const result = await bridge.invoke("settings.set", { key, value });
      if (!result.ok) throw new Error("setting");
      // Los eventos del host siguen siendo la fuente de los valores confirmados.
    });
  };
  const openFolder = () =>
    void run("folder", async () => {
      const result = await bridge.invoke("app.openDataFolder", {});
      if (!result.ok) throw new Error("folder");
    });
  return { states, info, update, openFolder };
}

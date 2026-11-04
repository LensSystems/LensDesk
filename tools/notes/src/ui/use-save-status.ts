import { useCallback, useRef, useState } from "react";

export type SavePhase = "idle" | "pending" | "saving" | "saved" | "error";
type Entry = { version: number; phase: SavePhase };

// Solo metadatos: los cuerpos y borradores permanecen en sus propietarios actuales.
export function useSaveStatus() {
  const entries = useRef(new Map<string, Entry>());
  const [states, setStates] = useState<Record<string, SavePhase>>({});
  const mark = useCallback((id: string, version: number, phase: SavePhase) => {
    if ((entries.current.get(id)?.version ?? 0) !== version) return;
    entries.current.set(id, { version, phase });
    setStates((previous) => ({ ...previous, [id]: phase }));
  }, []);
  const edit = useCallback((id: string) => {
    const version = (entries.current.get(id)?.version ?? 0) + 1;
    entries.current.set(id, { version, phase: "pending" });
    setStates((previous) => ({ ...previous, [id]: "pending" }));
  }, []);
  const reset = useCallback((id: string) => {
    const version = (entries.current.get(id)?.version ?? 0) + 1;
    entries.current.set(id, { version, phase: "idle" });
    setStates((previous) => ({ ...previous, [id]: "idle" }));
  }, []);
  const version = useCallback((id: string) => entries.current.get(id)?.version ?? 0, []);
  const resetAll = useCallback(() => {
    const next: Record<string, SavePhase> = {};
    for (const [id, entry] of entries.current) {
      entries.current.set(id, { version: entry.version + 1, phase: "idle" });
      next[id] = "idle";
    }
    setStates(next);
  }, []);
  const phase = useCallback((id: string) => entries.current.get(id)?.phase ?? "idle", []);
  return { states, mark, edit, reset, resetAll, version, phase };
}

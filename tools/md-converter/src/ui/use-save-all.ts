import { useEffect, useRef, useState } from "react";
import type { QueueItem } from "./use-queue.ts";

type Outcome = { kind: "stopped" | "failed" | "completed"; saved: number; total: number };

export function useSaveAll() {
  const running = useRef(false);
  const mounted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const saveAll = async (
    results: QueueItem[],
    saveOne: (result: QueueItem) => Promise<boolean>,
  ) => {
    if (running.current || results.length === 0) return;
    running.current = true;
    setBusy(true);
    setOutcome(null);
    const batch = results.map((result) => ({ ...result }));
    let saved = 0;
    const finish = (kind: Outcome["kind"]) => {
      if (mounted.current) setOutcome({ kind, saved, total: batch.length });
    };
    try {
      for (const result of batch) {
        if (!(await saveOne(result))) {
          finish("stopped");
          return;
        }
        saved++;
      }
      finish("completed");
    } catch {
      finish("failed");
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { busy, outcome, saveAll, isRunning: () => running.current };
}

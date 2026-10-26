import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { QueueItem } from "./use-queue.ts";

export function useCompletionMotion(item: QueueItem) {
  const previous = useRef(item);
  const root = useRef<HTMLLIElement>(null);
  const bar = useRef<{ top: number; left: number; width: number } | null>(null);
  const [motion, setMotion] = useState({
    done: false,
    saved: false,
    old: null as QueueItem | null,
    bar: null as typeof bar.current,
  });
  const clearMotion = useCallback(
    () => setMotion({ done: false, saved: false, old: null, bar: null }),
    [],
  );
  useLayoutEffect(() => {
    if (item.status === "converting") {
      const bounds = root.current?.getBoundingClientRect();
      const progress = root.current?.querySelector("[role=progressbar]")?.getBoundingClientRect();
      if (bounds && progress)
        bar.current = {
          top: progress.top - bounds.top,
          left: progress.left - bounds.left,
          width: progress.width,
        };
    }
    const old = previous.current;
    previous.current = item;
    const done = old.status !== "done" && item.status === "done";
    const saved = !old.saved && !!item.saved;
    if (!done && !saved) return;
    if (window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches !== true) return;
    setMotion({ done, saved, old: done ? old : null, bar: done ? bar.current : null });
  }, [item]);
  useEffect(() => {
    if (!motion.done && !motion.saved) return;
    const timer = setTimeout(clearMotion, 210);
    return () => clearTimeout(timer);
  }, [motion.done, motion.saved, clearMotion]);
  return { motion, clearMotion, root };
}

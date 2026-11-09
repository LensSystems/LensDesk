import { setImmediate } from "node:timers/promises";
import { checkCancelled } from "./domain.ts";
export function drain<T>(steps: Generator<unknown, T, unknown>): T {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}
export async function cooperate<T>(
  steps: Generator<unknown, T, unknown>,
  signal: AbortSignal,
): Promise<T> {
  let deadline = performance.now() + 8;
  try {
    for (;;) {
      checkCancelled(signal);
      const next = steps.next();
      if (next.done) return next.value;
      if (performance.now() >= deadline) {
        await setImmediate();
        checkCancelled(signal);
        deadline = performance.now() + 8;
      }
    }
  } finally {
    steps.return(undefined as T);
  }
}

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
  try {
    for (;;) {
      checkCancelled(signal);
      const next = steps.next();
      if (next.done) return next.value;
      await setImmediate();
      checkCancelled(signal);
    }
  } finally {
    steps.return(undefined as T);
  }
}

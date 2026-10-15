import { type BackendMethod, defineBackend } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";

// ping y slow no aceptan parámetros: cualquier valor distinto de vacío es un error del llamador.
function assertNoParams(params: unknown): void {
  const empty =
    params === undefined ||
    params === null ||
    (typeof params === "object" && !Array.isArray(params) && Object.keys(params).length === 0);
  if (!empty) throw new LensError("E_INVALID_PARAMS", "This method takes no parameters");
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new LensError("E_CANCELLED", "Request cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

export const methods = {
  ping: (params) => {
    assertNoParams(params);
    return { pong: true, at: new Date().toISOString() };
  },
  async slow(params, ctx) {
    assertNoParams(params);
    for (let step = 1; step <= 10; step += 1) {
      if (ctx.signal.aborted) throw new LensError("E_CANCELLED", "Request cancelled");
      ctx.progress(step / 10);
      await wait(100, ctx.signal);
    }
    return { done: true };
  },
} satisfies Record<string, BackendMethod>;

defineBackend({ methods });

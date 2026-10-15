import type { ProgressEvent } from "./api.ts";
import type { BackendContext } from "./backend.ts";

export type TestBackendContext = BackendContext & {
  fileBytes: Map<string, Uint8Array>;
  progressEvents: ProgressEvent[];
  logs: { level: "info" | "warn" | "error"; message: string }[];
};

export function createTestContext({ dataDir }: { dataDir: string }): TestBackendContext {
  const fileBytes = new Map<string, Uint8Array>();
  const progressEvents: ProgressEvent[] = [];
  const logs: TestBackendContext["logs"] = [];
  return {
    dataDir,
    fileBytes,
    progressEvents,
    logs,
    files: {
      readBytes: async (token) => {
        const bytes = fileBytes.get(token);
        if (!bytes) throw new Error(`Unknown file token: ${token}`);
        return bytes.slice();
      },
      writeBytes: async (token, bytes) => {
        fileBytes.set(token, bytes.slice());
      },
    },
    progress: (fraction, message) =>
      progressEvents.push({ fraction, ...(message === undefined ? {} : { message }) }),
    signal: new AbortController().signal,
    log: {
      info: (message) => logs.push({ level: "info", message }),
      warn: (message) => logs.push({ level: "warn", message }),
      error: (message) => logs.push({ level: "error", message }),
    },
  };
}

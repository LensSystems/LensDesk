import type { BackendContext } from "@lensdesk/sdk/backend";
import { LensError } from "@lensdesk/sdk/errors";
export function fileContext(dataDir: string) {
  const files = new Map<string, { bytes: Uint8Array; mode: "read" | "write"; owner: string }>();
  const ctx: BackendContext = {
    dataDir,
    signal: new AbortController().signal,
    progress: () => {},
    log: { info: () => {}, warn: () => {}, error: () => {} },
    files: {
      readBytes: async (token) => {
        const f = files.get(token);
        if (f?.mode !== "read" || f.owner !== "ventas")
          throw new LensError("E_PATH_NOT_GRANTED", "Token not readable");
        return f.bytes;
      },
      writeBytes: async (token, bytes) => {
        const f = files.get(token);
        if (f?.mode !== "write" || f.owner !== "ventas")
          throw new LensError("E_PATH_NOT_GRANTED", "Token not writable");
        f.bytes = bytes;
      },
    },
  };
  return {
    ctx,
    files,
    input: (bytes: Uint8Array, token = "input") => {
      files.set(token, { bytes, mode: "read", owner: "ventas" });
      return token;
    },
    output: (token = "output") => {
      files.set(token, { bytes: new Uint8Array(), mode: "write", owner: "ventas" });
      return token;
    },
  };
}

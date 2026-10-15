import { randomUUID } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";

type Mode = "read" | "write";
export function createFileTokens(options: {
  log?: (toolId: string, channel: string) => void;
  createId?: () => string;
}) {
  const tokens = new Map<string, { toolId: string; path: string; mode: Mode }>();
  return {
    grant(toolId: string, path: string, mode: Mode): string {
      const token = (options.createId ?? randomUUID)();
      tokens.set(token, { toolId, path, mode });
      return token;
    },
    resolve(toolId: string, token: string, mode: Mode, channel = "files.unknown"): string {
      const entry = tokens.get(token);
      if (!entry || entry.toolId !== toolId || entry.mode !== mode) {
        options.log?.(toolId, channel);
        throw new LensError("E_PATH_NOT_GRANTED", "El archivo no está autorizado.");
      }
      return entry.path;
    },
    revoke(toolId: string): void {
      for (const [token, entry] of tokens) if (entry.toolId === toolId) tokens.delete(token);
    },
  };
}
export type FileTokens = ReturnType<typeof createFileTokens>;

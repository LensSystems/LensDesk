import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { toolManifestSchema } from "@lensdesk/sdk";
import type { createToolRegistry } from "./registry.ts";

export async function scanDevTools(options: {
  directory: string | undefined;
  isPackaged: boolean;
  registry: ReturnType<typeof createToolRegistry>;
  now?: () => string;
  fs?: Pick<typeof import("node:fs/promises"), "readdir" | "readFile">;
}): Promise<void> {
  if (!options.directory || options.isPackaged) return;
  const fs = options.fs ?? { readdir, readFile };
  let names: string[];
  try {
    names = await fs.readdir(options.directory);
  } catch {
    return;
  }
  for (const name of names) {
    for (const candidate of [
      join(options.directory, name, "dist"),
      join(options.directory, name),
    ]) {
      try {
        const raw = JSON.parse(
          await fs.readFile(join(candidate, "lensdesk.tool.json"), "utf8"),
        ) as unknown;
        const parsed = toolManifestSchema.safeParse(raw);
        if (!parsed.success) continue;
        const manifest = parsed.data;
        const now = (options.now ?? (() => new Date().toISOString()))();
        const existing = options.registry.get(manifest.id);
        options.registry.upsert({
          id: manifest.id,
          version: manifest.version,
          manifest: manifest as unknown as Record<string, unknown>,
          installPath: resolve(candidate),
          enabled: existing?.enabled ?? true,
          signed: false,
          keyId: null,
          installedAt: existing?.installedAt ?? now,
          updatedAt: now,
        });
        break;
      } catch {
        // A missing or malformed development tool is skipped.
      }
    }
  }
}

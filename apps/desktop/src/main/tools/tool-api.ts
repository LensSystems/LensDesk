import { Buffer } from "node:buffer";
import { LensError } from "@lensdesk/sdk/errors";
import { TOOL_CHANNELS } from "../../shared/tool-channels.ts";
import type { SqliteDatabase } from "../db/database.ts";
import { toolIpcSchemas } from "../ipc/tool-schemas.ts";

const MAX_VALUE_BYTES = 1024 * 1024;
type Tool = { id: string; version: string; manifest: Record<string, unknown>; enabled: boolean };
type Context = { locale: string; theme: string };
type ToolView = { webContents: { id: number; send?(channel: string, payload: unknown): void } };
type Result = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Result => ({ ok: false, error: { code, message } });

export function createToolApi(options: {
  registry: { get(id: string): Tool | undefined };
  db: SqliteDatabase;
  context: () => Context;
  log?: (toolId: string, toast: { kind: string; message: string }) => void;
  views: () => ToolView[];
  viewId: (webContentsId: number) => string | undefined;
  hostVersion: string;
  clipboard: (text: string) => void;
  openExternal: (url: string) => Promise<void>;
}) {
  return {
    invoke: async (sender: unknown, channel: string, payload: unknown): Promise<Result> => {
      if (!TOOL_CHANNELS.includes(channel as (typeof TOOL_CHANNELS)[number]))
        return fail("E_METHOD_NOT_FOUND", "Canal desconocido");
      const schema = toolIpcSchemas[channel as keyof typeof toolIpcSchemas];
      const parsed = schema.request.safeParse(payload);
      if (!parsed.success) return fail("E_INVALID_PARAMS", parsed.error.message);
      try {
        const id = (sender as { id?: number } | null)?.id;
        const toolId = typeof id === "number" ? options.viewId(id) : undefined;
        if (!toolId) throw new LensError("E_PERMISSION_DENIED", "Emisor no autorizado");
        const tool = options.registry.get(toolId);
        if (!tool?.enabled) throw new LensError("E_PERMISSION_DENIED", "Herramienta no autorizada");
        const input = parsed.data as Record<string, unknown>;
        const requirePermission = (permission: string) => {
          const manifestPermissions = tool.manifest.permissions;
          if (!Array.isArray(manifestPermissions) || !manifestPermissions.includes(permission))
            throw new LensError("E_PERMISSION_DENIED", "Permiso no concedido");
        };
        let data: unknown;
        if (channel.startsWith("storage.")) {
          requirePermission("storage");
          const key = input.key as string;
          if (channel === "storage.get") {
            const row = options.db
              .prepare("SELECT value_json FROM tool_kv WHERE tool_id = ? AND key = ?")
              .get(toolId, key) as { value_json: string } | undefined;
            data = row ? JSON.parse(row.value_json) : null;
          } else if (channel === "storage.set") {
            // undefined (o una función) no tiene representación JSON y no se puede guardar.
            const value = JSON.stringify(input.value) as string | undefined;
            if (value === undefined)
              throw new LensError("E_INVALID_PARAMS", "El valor no se puede guardar como JSON.");
            if (Buffer.byteLength(value, "utf8") > MAX_VALUE_BYTES)
              throw new LensError("E_TOO_LARGE", "El valor supera 1 MB.");
            options.db
              .prepare(
                "INSERT INTO tool_kv (tool_id, key, value_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tool_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
              )
              .run(toolId, key, value, new Date().toISOString());
            data = undefined;
          } else if (channel === "storage.delete") {
            options.db
              .prepare("DELETE FROM tool_kv WHERE tool_id = ? AND key = ?")
              .run(toolId, key);
            data = undefined;
          } else {
            data = (
              options.db
                .prepare("SELECT key FROM tool_kv WHERE tool_id = ? ORDER BY key")
                .all(toolId) as { key: string }[]
            ).map(({ key: storedKey }) => storedKey);
          }
        } else if (channel === "app.getContext") {
          data = {
            ...options.context(),
            hostVersion: options.hostVersion,
            toolVersion: tool.version,
          };
        } else if (channel === "ui.copyText") {
          options.clipboard(input.text as string);
          data = undefined;
        } else if (channel === "ui.toast") {
          options.log?.(toolId, input as { kind: string; message: string });
          data = undefined;
        } else if (channel === "ui.openExternal") {
          let url: URL;
          try {
            url = new URL(input.url as string);
          } catch {
            throw new LensError("E_INVALID_PARAMS", "URL inválida.");
          }
          if (url.protocol !== "https:")
            throw new LensError("E_INVALID_PARAMS", "Solo se permiten URL HTTPS.");
          await options.openExternal(url.toString());
          data = undefined;
        } else {
          if (channel.startsWith("files.")) requirePermission("files");
          if (channel.startsWith("backend.")) requirePermission("backend");
          throw new LensError("E_BACKEND_UNAVAILABLE", "Esta función aún no está disponible.");
        }
        const response = schema.response.safeParse(data);
        return response.success
          ? { ok: true, data: response.data }
          : fail("E_INTERNAL", "Respuesta IPC inválida");
      } catch (error) {
        if (error instanceof LensError) return fail(error.code, error.message);
        return fail("E_INTERNAL", "Error interno");
      }
    },
    publishContext(context: Context) {
      for (const view of options.views()) {
        const id = options.viewId(view.webContents.id);
        const tool = id ? options.registry.get(id) : undefined;
        if (tool)
          view.webContents.send?.("lensdesk:tool-event:app.contextChanged", {
            ...context,
            hostVersion: options.hostVersion,
            toolVersion: tool.version,
          });
      }
    },
  };
}

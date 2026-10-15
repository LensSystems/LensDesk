import { z } from "zod";
import type { ToolChannel } from "../../shared/tool-channels.ts";

const key = z.string().min(1).max(256);
const fileFilter = z.object({ name: z.string(), extensions: z.array(z.string()) }).strict();
const unavailable = { response: z.unknown() };
const handle = z
  .object({ token: z.string(), name: z.string(), size: z.number().nonnegative() })
  .strict();
export const toolIpcSchemas = {
  "storage.get": { request: z.object({ key }).strict(), response: z.unknown() },
  "storage.set": { request: z.object({ key, value: z.unknown() }).strict(), response: z.unknown() },
  "storage.delete": { request: z.object({ key }).strict(), response: z.unknown() },
  "storage.keys": { request: z.object({}).strict(), response: z.array(z.string()) },
  "files.pickOpen": {
    request: z
      .object({ filters: z.array(fileFilter).optional(), multiple: z.boolean().optional() })
      .strict(),
    response: z.array(handle),
  },
  "files.pickSave": {
    request: z
      .object({ defaultName: z.string().optional(), filters: z.array(fileFilter).optional() })
      .strict(),
    response: handle.nullable(),
  },
  "files.readText": {
    request: z.object({ token: z.string().min(1) }).strict(),
    response: z.string(),
  },
  "files.readBytes": {
    request: z.object({ token: z.string().min(1) }).strict(),
    response: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  },
  "files.writeText": {
    request: z.object({ token: z.string().min(1), text: z.string() }).strict(),
    response: z.void(),
  },
  "backend.invoke": {
    request: z
      .object({ requestId: z.string().min(1), method: z.string().min(1), params: z.unknown() })
      .strict(),
    ...unavailable,
  },
  "backend.cancel": {
    request: z.object({ requestId: z.string().min(1) }).strict(),
    ...unavailable,
  },
  "app.getContext": {
    request: z.object({}).strict(),
    response: z
      .object({
        locale: z.string(),
        theme: z.string(),
        hostVersion: z.string(),
        toolVersion: z.string(),
      })
      .strict(),
  },
  "ui.toast": {
    request: z
      .object({
        kind: z.string().min(1).max(32),
        message: z.string().min(1).max(500),
      })
      .strict(),
    ...unavailable,
  },
  "ui.copyText": { request: z.object({ text: z.string() }).strict(), ...unavailable },
  "ui.openExternal": { request: z.object({ url: z.string() }).strict(), ...unavailable },
} satisfies Record<ToolChannel, { request: z.ZodType; response: z.ZodType }>;

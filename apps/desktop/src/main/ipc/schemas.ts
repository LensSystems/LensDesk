import { z } from "zod";
import type { HostChannel } from "../../shared/host-channels.ts";
import { isHttpsUrl } from "../app-actions.ts";
import { type SettingKey, settingSchemas } from "../db/settings-repo.ts";

const settingKeySchema = z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]);

const tabsResponseSchema = z
  .object({
    tabs: z.array(
      z
        .object({
          toolId: z.string(),
          position: z.number().int().nonnegative(),
          active: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
const toolSchema = z
  .object({
    id: z.string(),
    version: z.string(),
    manifest: z.record(z.string(), z.unknown()),
    enabled: z.boolean(),
    signed: z.boolean(),
    keyId: z.string().nullable(),
    installedAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const toolStateSchema = z
  .object({
    tools: z.array(toolSchema),
    pendingDowngrade: z
      .object({ toolId: z.string(), installedVersion: z.string(), version: z.string() })
      .strict()
      .nullable(),
  })
  .strict();

export const ipcSchemas = {
  "app.getInfo": {
    request: z.object({}).strict(),
    response: z.object({ version: z.string(), platform: z.string() }).strict(),
  },
  "settings.get": {
    request: z.object({ key: settingKeySchema }).strict(),
    response: z.object({ key: settingKeySchema, value: z.unknown() }).strict(),
  },
  "settings.set": {
    request: z.object({ key: settingKeySchema, value: z.unknown() }).strict(),
    response: z.object({ key: settingKeySchema, value: z.unknown() }).strict(),
  },
  "app.getContext": {
    request: z.object({}).strict(),
    response: z
      .object({
        locale: z.enum(["es", "en"]),
        theme: z.enum(["dark", "light"]),
        accent: z.enum(["blue", "green"]),
      })
      .strict(),
  },
  "tabs.list": {
    request: z.object({}).strict(),
    response: tabsResponseSchema,
  },
  "tabs.open": {
    request: z.object({ toolId: z.string().min(1) }).strict(),
    response: tabsResponseSchema,
  },
  "tabs.close": {
    request: z.object({ toolId: z.string().min(1) }).strict(),
    response: tabsResponseSchema,
  },
  "tabs.activate": {
    request: z.object({ toolId: z.string().min(1) }).strict(),
    response: tabsResponseSchema,
  },
  "shell.showPage": {
    request: z.object({ page: z.enum(["tools", "settings"]) }).strict(),
    response: z.object({ page: z.enum(["tools", "settings"]) }).strict(),
  },
  "tools.list": { request: z.object({}).strict(), response: toolStateSchema },
  "tools.pickAndInstall": { request: z.object({}).strict(), response: toolStateSchema },
  "tools.installFromPath": {
    request: z.object({ path: z.string().min(1) }).strict(),
    response: toolStateSchema,
  },
  "tools.confirmDowngrade": {
    request: z.object({ toolId: z.string().min(1), version: z.string().min(1) }).strict(),
    response: toolStateSchema,
  },
  "tools.setEnabled": {
    request: z.object({ toolId: z.string().min(1), enabled: z.boolean() }).strict(),
    response: toolStateSchema,
  },
  "tools.remove": {
    request: z.object({ toolId: z.string().min(1), deleteData: z.boolean() }).strict(),
    response: toolStateSchema,
  },
  "logs.export": {
    request: z.object({}).strict(),
    response: z.object({ saved: z.boolean() }).strict(),
  },
  "app.openDataFolder": {
    request: z.object({}).strict(),
    response: z.object({}).strict(),
  },
  "app.openExternal": {
    request: z
      .object({
        url: z.string().max(2048).refine(isHttpsUrl, { message: "Solo se abren enlaces https." }),
      })
      .strict(),
    response: z.object({}).strict(),
  },
  "updates.checkNow": {
    request: z.object({}).strict(),
    response: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("skipped") }).strict(),
      z.object({ kind: z.literal("none") }).strict(),
      z
        .object({
          kind: z.literal("available"),
          version: z.string(),
          url: z.string().refine(isHttpsUrl),
        })
        .strict(),
    ]),
  },
} satisfies Record<HostChannel, { request: z.ZodType; response: z.ZodType }>;

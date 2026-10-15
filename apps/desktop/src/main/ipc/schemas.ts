import { z } from "zod";
import type { HostChannel } from "../../shared/host-channels.ts";
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
    response: z.object({ locale: z.enum(["es", "en"]), theme: z.enum(["dark", "light"]) }).strict(),
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
} satisfies Record<HostChannel, { request: z.ZodType; response: z.ZodType }>;

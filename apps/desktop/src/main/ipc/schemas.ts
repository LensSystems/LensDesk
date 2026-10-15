import { z } from "zod";
import type { HostChannel } from "../../shared/host-channels.ts";
import { type SettingKey, settingSchemas } from "../db/settings-repo.ts";

const settingKeySchema = z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]);

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
} satisfies Record<HostChannel, { request: z.ZodType; response: z.ZodType }>;

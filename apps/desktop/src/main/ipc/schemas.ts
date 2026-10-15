import { z } from "zod";
import type { HostChannel } from "../../shared/host-channels.ts";

export const ipcSchemas = {
  "app.getInfo": {
    request: z.object({}).strict(),
    response: z.object({ version: z.string(), platform: z.string() }).strict(),
  },
} satisfies Record<HostChannel, { request: z.ZodType; response: z.ZodType }>;

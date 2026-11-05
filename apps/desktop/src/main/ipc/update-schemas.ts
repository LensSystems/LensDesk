import { z } from "zod";
import { isHttpsUrl } from "../app-actions.ts";

const https = z.string().refine(isHttpsUrl);
const toolUpdates = z.array(z.object({ id: z.string(), version: z.string(), url: https }).strict());
const incompatible = z.array(
  z
    .object({
      id: z.string(),
      version: z.string(),
      apiVersion: z.number().int().positive(),
      minHostVersion: z.string(),
      notesUrl: https,
      reasons: z
        .array(z.enum(["apiVersion", "minHostVersion"]))
        .min(1)
        .max(2),
    })
    .strict(),
);
const status = z.enum(["success", "error", "not-checked"]);
export const updateSourcesSchema = z
  .object({
    app: z
      .object({
        status,
        update: z
          .object({ version: z.string(), html_url: https, installerUrl: https.optional() })
          .strict()
          .nullable(),
      })
      .strict(),
    tools: z.object({ status, updates: toolUpdates, incompatible }).strict(),
  })
  .strict();
const extra = {
  tools: toolUpdates.optional(),
  incompatible: incompatible.optional(),
  sources: updateSourcesSchema.optional(),
};
export const updateCheckResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("skipped"), ...extra }).strict(),
  z.object({ kind: z.literal("none"), ...extra }).strict(),
  z.object({ kind: z.literal("error"), ...extra }).strict(),
  z
    .object({
      kind: z.literal("available"),
      version: z.string(),
      url: https,
      installerUrl: https.optional(),
      ...extra,
    })
    .strict(),
]);
export const updatesCheckedEventSchema = z.object({ sources: updateSourcesSchema }).strict();

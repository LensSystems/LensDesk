import semver from "semver";
import { z } from "zod";

export const MANIFEST_FILENAME = "lensdesk.tool.json";
export const SUPPORTED_API_VERSIONS = [1] as const;

const translationsSchema = z.object({ es: z.string().trim().min(1), en: z.string().trim().min(1) });

export const toolManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
    name: translationsSchema,
    description: translationsSchema,
    version: z.string().refine((value) => semver.valid(value) !== null, "Invalid semver"),
    apiVersion: z.number().int(),
    icon: z.string().trim().min(1),
    ui: z.object({ entry: z.literal("ui/index.html") }),
    backend: z.object({ entry: z.literal("backend/index.js") }).optional(),
    permissions: z
      .array(z.enum(["storage", "files", "backend"]))
      .refine((permissions) => new Set(permissions).size === permissions.length),
    minHostVersion: z.string().refine((value) => semver.valid(value) !== null, "Invalid semver"),
  })
  .superRefine((manifest, context) => {
    if (manifest.backend && !manifest.permissions.includes("backend")) {
      context.addIssue({
        code: "custom",
        path: ["backend"],
        message: "backend permission is required",
      });
    }
  });

export type ToolManifest = z.infer<typeof toolManifestSchema>;

import { z } from "zod";

const asset = (id: "notes" | "md-converter") =>
  z
    .object({
      id: z.literal(id),
      name: z.literal(`${id}-0.4.0.lenspkg`),
      url: z.literal(
        `https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/${id}-0.4.0.lenspkg`,
      ),
      size: z
        .number()
        .int()
        .positive()
        .max(100 * 1024 * 1024),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();

export const bootstrapManifestSchema = z.tuple([asset("notes"), asset("md-converter")]);
export type BootstrapManifest = z.infer<typeof bootstrapManifestSchema>;

// Original public v0.4.0 bytes, independently checked against historical release
// digests and verified with the release public key. Remote sums are additional
// consistency checks; they cannot replace these immutable trust anchors.
export const ORIGINAL_BOOTSTRAP_MANIFEST: BootstrapManifest = bootstrapManifestSchema.parse([
  {
    id: "notes",
    name: "notes-0.4.0.lenspkg",
    url: "https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/notes-0.4.0.lenspkg",
    size: 694704,
    sha256: "23506f00931feb573ea6529c4d7bd6d9211463461d32a3ac05e1dc5f36e6a889",
  },
  {
    id: "md-converter",
    name: "md-converter-0.4.0.lenspkg",
    url: "https://github.com/LensSystems/LensDesk/releases/download/v0.4.0/md-converter-0.4.0.lenspkg",
    size: 1404191,
    sha256: "993151dadcbc24f39568095a357724d1544f023ffbc48c951a2a3a74a3e38f5a",
  },
]);
for (const entry of ORIGINAL_BOOTSTRAP_MANIFEST) Object.freeze(entry);
Object.freeze(ORIGINAL_BOOTSTRAP_MANIFEST);

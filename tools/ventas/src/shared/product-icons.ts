import { z } from "zod";

export const productIconSchema = z.enum([
  "cookie",
  "croissant",
  "donut",
  "popcorn",
  "nut",
  "candy",
  "package",
  "milk",
]);
export type ProductIconName = z.infer<typeof productIconSchema>;
export function knownProductIcon(value: unknown): ProductIconName | null {
  const parsed = productIconSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

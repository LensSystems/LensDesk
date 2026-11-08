import { createHash } from "node:crypto";
import { normalizeSettings, settingsInputSchema } from "../shared/values.ts";

export function normalizeLegacySettings(input: unknown) {
  const settings = settingsInputSchema.parse(input);
  const reserved = new Set(settings.banks.map((bank) => bank.id));
  const seen = new Set<string>();
  const banks = settings.banks.map((bank, index) => {
    if (!seen.has(bank.id)) {
      seen.add(bank.id);
      return bank;
    }
    let attempt = 0;
    let id: string;
    do {
      const bytes = createHash("sha256")
        .update(`ventas:legacy-bank:${bank.id}:${index}:${attempt++}`)
        .digest();
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
      const hex = bytes.subarray(0, 16).toString("hex");
      id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } while (reserved.has(id));
    reserved.add(id);
    return { ...bank, id, originalId: bank.id };
  });
  return normalizeSettings({ ...settings, banks });
}

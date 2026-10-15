import en from "./locales/en.json";
import es from "./locales/es.json";

type Locale = "es" | "en";
type TranslationKey = "menu" | "schemaTooNew";

export function createTranslator(locale: Locale) {
  const messages = locale === "en" ? en : es;
  return (key: string, values?: Record<string, string | number>): string => {
    const [group, name] = key.split(".") as [TranslationKey, string];
    const entries = messages[group] as Record<string, string>;
    const template = entries[name];
    if (!template) return key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, variable: string) =>
      String(values?.[variable] ?? ""),
    );
  };
}

export type CredentialField = { title: string; value: string; secret: boolean };
export type Credential = {
  user: string;
  password: string;
  note: string;
  fields: CredentialField[];
};
export const emptyCredential = (): Credential => ({ user: "", password: "", note: "", fields: [] });
const escapeValue = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/`/g, "\\x60");
const unescapeValue = (value: string) =>
  value.replace(
    /\\(x60|[\\|nr])/g,
    (_, code: string) => ({ n: "\n", r: "\r", x60: "`" })[code] ?? code,
  );
export function formatCredential(value: Credential): string {
  return (
    "```credential\n" +
    [
      `user: ${escapeValue(value.user)}`,
      `password: ${escapeValue(value.password)}`,
      `note: ${escapeValue(value.note)}`,
      ...value.fields.map(
        (field) =>
          `${field.secret ? "secret" : "field"}: ${escapeValue(field.title)} | ${escapeValue(field.value)}`,
      ),
    ].join("\n") +
    "\n```"
  );
}
export function parseCredential(source: string): Credential {
  const value = emptyCredential();
  for (const line of source.split(/\r?\n/)) {
    const match = /^(user|password|note|field|secret): ?(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw = ""] = match;
    if (key === "user" || key === "password" || key === "note") value[key] = unescapeValue(raw);
    else {
      let separator = -1;
      for (let index = 0; index < raw.length; index++) {
        if (raw[index] === "\\") {
          index++;
          continue;
        }
        if (raw[index] === "|") {
          separator = index;
          break;
        }
      }
      if (separator >= 0)
        value.fields.push({
          title: unescapeValue(raw.slice(0, separator).replace(/ $/, "")),
          value: unescapeValue(raw.slice(separator + 1).replace(/^ /, "")),
          secret: key === "secret",
        });
    }
  }
  return value;
}

import type { CredentialField } from "./credential-block.ts";
import { parseCredential } from "./credential-block.ts";
export const CREDENTIAL_TOKEN = crypto.randomUUID();
export type CredentialPreview = { fields: CredentialField[]; labels: Record<string, string> };
export function credentialCard(
  content: string,
  data: CredentialPreview,
  escapeHtml: (value: string) => string,
) {
  const value = parseCredential(content);
  const fields = [
    { title: data.labels.user ?? "", value: value.user, secret: false },
    { title: data.labels.password ?? "", value: value.password, secret: true },
    { title: data.labels.note ?? "", value: value.note, secret: false },
    ...value.fields,
  ];
  return `<section class="ld-credential">${fields
    .map((field) => {
      const index = data.fields.push(field) - 1;
      const control = `data-credential="${CREDENTIAL_TOKEN}" data-field="${index}"`;
      return `<div><strong>${escapeHtml(field.title)}</strong><span data-credential-value="${index}">${field.secret ? "•••••••" : escapeHtml(field.value)}</span><button type="button" ${control} data-action="copy">${escapeHtml(data.labels.copy ?? "")}</button>${field.secret ? `<button type="button" ${control} data-action="reveal">${escapeHtml(data.labels.show ?? "")}</button>` : ""}</div>`;
    })
    .join("")}</section>\n`;
}

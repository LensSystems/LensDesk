import type { CredentialField } from "./credential-block.ts";
import { parseCredential } from "./credential-block.ts";
import { copyIcon, eyeIcon, keyIcon } from "./preview-controls.ts";
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
    ...value.fields,
    { title: data.labels.note ?? "", value: value.note, secret: false },
  ];
  return `<section class="ld-credential"><header>${keyIcon}<strong>${escapeHtml(data.labels.title ?? "")}</strong></header>${fields
    .map((field) => {
      const index = data.fields.push(field) - 1;
      const control = `data-credential="${CREDENTIAL_TOKEN}" data-field="${index}"`;
      return `<div><strong>${escapeHtml(field.title)}</strong><span data-credential-value="${index}">${field.secret ? "•••••••" : escapeHtml(field.value)}</span>${field.secret ? `<button type="button" ${control} data-action="reveal" aria-label="${escapeHtml(data.labels.show ?? "")}" title="${escapeHtml(data.labels.show ?? "")}">${eyeIcon}</button>` : ""}<button type="button" ${control} data-action="copy" aria-label="${escapeHtml(data.labels.copy ?? "")}" title="${escapeHtml(data.labels.copy ?? "")}">${copyIcon}</button></div>`;
    })
    .join("")}</section>\n`;
}

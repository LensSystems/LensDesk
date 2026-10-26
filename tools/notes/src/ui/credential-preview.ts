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
    .map((field, position) => {
      const note = position === fields.length - 1;
      const label = (action: string) =>
        escapeHtml((data.labels[action] ?? "").replace("{{name}}", field.title));
      const index = data.fields.push(field) - 1;
      const control = `data-credential="${CREDENTIAL_TOKEN}" data-field="${index}"`;
      return `<div${note ? ' class="credential-note"' : ""}><strong>${escapeHtml(field.title)}</strong><span class="${field.secret ? "font-mono" : ""}" data-credential-value="${index}">${field.secret ? "*******" : escapeHtml(field.value)}</span>${field.secret ? `<button type="button" ${control} data-action="reveal" aria-label="${label("show")}" title="${label("show")}">${eyeIcon}</button>` : ""}${note ? "" : `<button type="button" ${control} data-action="copy" aria-label="${label("copy")}" title="${label("copy")}">${copyIcon}</button>`}</div>`;
    })
    .join("")}</section>\n`;
}

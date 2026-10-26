import { MarkdownView } from "@lensdesk/ui";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CREDENTIAL_TOKEN, type CredentialPreview } from "./credential-preview.ts";
import { COPY_CODE_TOKEN, renderPreview } from "./preview.ts";
import { confirmCopy, eyeIcon, eyeOffIcon, resetCopy } from "./preview-controls.ts";

export function NotePreview({
  body,
  privateNote = false,
  onCopyCode,
}: {
  body: string;
  privateNote?: boolean;
  onCopyCode: (code: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const rendered = useMemo(() => {
    const credentials: CredentialPreview = {
      fields: [],
      labels: Object.fromEntries(
        ["title", "user", "password", "note", "copy", "show", "hide"].map((key) => [
          key,
          t(`credential.${["copy", "show", "hide"].includes(key) ? `${key}Field` : key}`, {
            name: "{{name}}",
          }),
        ]),
      ),
    };
    return {
      html: renderPreview(body, t("copyCode"), privateNote ? credentials : undefined),
      credentials,
    };
  }, [body, privateNote, t]);
  // Referencias a lo último recibido: el efecto no se reinstala (ni cancela «Copiado») en cada render.
  const latest = useRef({ onCopyCode, t, rendered });
  latest.current = { onCopyCode, t, rendered };
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
    let active = true;
    const confirm = (button: HTMLButtonElement, label: () => string) => {
      if (!active || !container.contains(button)) return;
      confirmCopy(button, latest.current.t("copied"));
      clearTimeout(timers.get(button));
      timers.set(
        button,
        setTimeout(() => {
          resetCopy(button, label());
          timers.delete(button);
        }, 2000),
      );
    };
    const copy = async (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const credential = event.target.closest<HTMLButtonElement>("button[data-credential]");
      if (credential?.dataset.credential === CREDENTIAL_TOKEN && container.contains(credential)) {
        const index = Number(credential.dataset.field);
        const field = latest.current.rendered.credentials.fields[index];
        if (!field) return;
        if (credential.dataset.action === "copy") {
          try {
            await latest.current.onCopyCode(field.value);
            confirm(credential, () =>
              latest.current.t("credential.copyField", { name: field.title }),
            );
          } catch {
            /* Conserva el control al rechazar la copia. */
          }
        } else if (credential.dataset.action === "reveal") {
          const span = credential.parentElement?.querySelector("[data-credential-value]");
          if (!span) return;
          const shown = credential.dataset.shown !== "true";
          span.textContent = shown ? field.value : "*******";
          credential.dataset.shown = String(shown);
          const label = latest.current.t(shown ? "credential.hideField" : "credential.showField", {
            name: field.title,
          });
          credential.setAttribute("aria-label", label);
          credential.title = label;
          credential.innerHTML = shown ? eyeOffIcon : eyeIcon;
        }
        return;
      }
      const button = event.target.closest<HTMLButtonElement>("button[data-copy-code]");
      if (!button || button.dataset.copyCode !== COPY_CODE_TOKEN) return;
      if (!container.contains(button)) return;
      const code = button.closest("figure.ld-code-block")?.querySelector(":scope > pre > code");
      if (!code) return;
      try {
        await latest.current.onCopyCode(code.textContent ?? "");
        confirm(button, () => latest.current.t("copyCode"));
      } catch {
        // Conserva la etiqueta si el portapapeles rechaza la copia.
      }
    };
    container.addEventListener("click", copy);
    return () => {
      active = false;
      container.removeEventListener("click", copy);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={host} className="min-h-0 flex-1 overflow-auto p-6">
      <MarkdownView html={rendered.html} />
    </div>
  );
}

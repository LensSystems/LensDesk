import { MarkdownView, Notice } from "@lensdesk/ui";
import { useEffect, useMemo, useRef, useState } from "react";
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
      revision: Symbol(),
      html: renderPreview(body, t("copyCode"), privateNote ? credentials : undefined),
      credentials,
    };
  }, [body, privateNote, t]);
  const revision = rendered.revision;
  const [copyFailure, setCopyFailure] = useState<symbol | null>(null);
  // Referencias a lo último recibido: el efecto no se reinstala (ni cancela «Copiado») en cada render.
  const latest = useRef({ onCopyCode, t, rendered, revision });
  latest.current = { onCopyCode, t, rendered, revision };
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
    let active = true;
    let lastCopy: symbol | undefined;
    const operations = new WeakMap<HTMLButtonElement, symbol>();
    const current = (button: HTMLButtonElement, at: symbol) =>
      active && container.contains(button) && latest.current.revision === at;
    const prepare = (button: HTMLButtonElement) => {
      setCopyFailure(null);
      const operation = Symbol();
      lastCopy = operation;
      operations.set(button, operation);
      return { revision: latest.current.revision, operation };
    };
    const confirm = (button: HTMLButtonElement, label: () => string) => {
      if (!active || !container.contains(button)) return;
      const at = latest.current.revision;
      confirmCopy(button, latest.current.t("copied"));
      clearTimeout(timers.get(button));
      timers.set(
        button,
        setTimeout(() => {
          if (current(button, at)) resetCopy(button, label());
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
          const at = prepare(credential);
          try {
            await latest.current.onCopyCode(field.value);
            if (!current(credential, at.revision) || operations.get(credential) !== at.operation)
              return;
            if (lastCopy === at.operation) setCopyFailure(null);
            confirm(credential, () =>
              latest.current.t("credential.copyField", { name: field.title }),
            );
          } catch {
            if (current(credential, at.revision) && operations.get(credential) === at.operation) {
              clearTimeout(timers.get(credential));
              timers.delete(credential);
              if (credential.classList.contains("copy-confirmation"))
                resetCopy(
                  credential,
                  latest.current.t("credential.copyField", { name: field.title }),
                );
              if (lastCopy === at.operation) setCopyFailure(at.revision);
            }
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
      const at = prepare(button);
      try {
        await latest.current.onCopyCode(code.textContent ?? "");
        if (!current(button, at.revision) || operations.get(button) !== at.operation) return;
        if (lastCopy === at.operation) setCopyFailure(null);
        confirm(button, () => latest.current.t("copyCode"));
      } catch {
        if (current(button, at.revision) && operations.get(button) === at.operation) {
          clearTimeout(timers.get(button));
          timers.delete(button);
          if (button.classList.contains("copy-confirmation"))
            resetCopy(button, latest.current.t("copyCode"));
          if (lastCopy === at.operation) setCopyFailure(at.revision);
        }
      }
    };
    container.addEventListener("click", copy);
    return () => {
      active = false;
      container.removeEventListener("click", copy);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (latest.current.revision !== revision) return;
    for (const button of host.current?.querySelectorAll<HTMLButtonElement>(
      "button.copy-confirmation",
    ) ?? []) {
      const field = latest.current.rendered.credentials.fields[Number(button.dataset.field)];
      resetCopy(
        button,
        field
          ? latest.current.t("credential.copyField", { name: field.title })
          : latest.current.t("copyCode"),
      );
    }
  }, [revision]);

  return (
    <div ref={host} className="min-h-0 flex-1 overflow-auto p-6">
      {copyFailure === revision && <Notice tone="danger" title={t("copyError")} className="mb-3" />}
      <MarkdownView variant="reading" html={rendered.html} />
    </div>
  );
}

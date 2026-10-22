import { MarkdownView } from "@lensdesk/ui";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { COPY_CODE_TOKEN, renderPreview } from "./preview.ts";

export function NotePreview({
  body,
  onCopyCode,
}: {
  body: string;
  onCopyCode: (code: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderPreview(body, t("copyCode")), [body, t]);
  // Referencias a lo último recibido: el efecto no se reinstala (ni cancela «Copiado») en cada render.
  const latest = useRef({ onCopyCode, t });
  latest.current = { onCopyCode, t };
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
    let active = true;
    const copy = async (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>("button[data-copy-code]");
      if (!button || button.dataset.copyCode !== COPY_CODE_TOKEN) return;
      if (!container.contains(button)) return;
      const code = button.closest("figure.ld-code-block")?.querySelector(":scope > pre > code");
      if (!code) return;
      try {
        await latest.current.onCopyCode(code.textContent ?? "");
        if (!active || !container.contains(button)) return;
        button.textContent = latest.current.t("copied");
        clearTimeout(timers.get(button));
        timers.set(
          button,
          setTimeout(() => {
            button.textContent = latest.current.t("copyCode");
            timers.delete(button);
          }, 2000),
        );
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
      <MarkdownView html={html} />
    </div>
  );
}

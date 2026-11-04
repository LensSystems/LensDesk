import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { SavePhase } from "./use-save-status.ts";

export function SaveStatus({
  phase = "idle",
  onRetry,
}: {
  phase?: SavePhase;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="note-save-status" data-save-phase={phase}>
      <span role="status" aria-live="polite" aria-atomic="true" className="text-muted">
        {phase === "saving" || phase === "saved" ? t(`saveState.${phase}`) : ""}
      </span>
      {phase === "error" ? (
        <div role="alert" className="text-danger">
          <span className="sr-only">{t("saveState.error")}</span>
          <span aria-hidden="true">{t("saveState.errorShort")}</span>
          <Button
            variant="ghost"
            className="h-5 px-1 text-[11px]"
            onMouseDown={(event) => event.preventDefault()}
            aria-label={t("retrySave")}
            onClick={(event) => {
              const panel = event.currentTarget.closest(".editor-panel");
              const editor = panel?.querySelector<HTMLElement>(
                '.cm-content[contenteditable="true"]',
              );
              const target = editor?.checkVisibility?.()
                ? editor
                : panel?.querySelector<HTMLElement>(".note-title button");
              target?.focus();
              onRetry?.();
            }}
          >
            {t("retrySaveShort")}
          </Button>
        </div>
      ) : phase === "idle" || phase === "pending" ? (
        <span className="text-muted">{t(`saveState.${phase}`)}</span>
      ) : null}
    </div>
  );
}

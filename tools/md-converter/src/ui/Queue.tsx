import {
  BrushCleaning,
  ConfirmDialog,
  FileDropZone,
  IconButton,
  SwapText,
  Upload,
} from "@lensdesk/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QueueCard } from "./QueueCard.tsx";
import type { QueueItem } from "./use-queue.ts";

export function Queue({
  items,
  selectedId,
  onChoose,
  onSelect,
  onCancel,
  onClear,
}: {
  items: QueueItem[];
  selectedId: string | null;
  onChoose: () => void;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
  onClear: () => void;
}) {
  const { t, i18n } = useTranslation();
  // El número va en su propia pieza, esté donde esté en la frase de cada idioma.
  const [headingBefore, headingAfter = ""] = t("historyHeading", { count: "\u0000" }).split(
    "\u0000",
  );
  const [compact, setCompact] = useState(
    () => window.matchMedia?.("(max-width: 900px)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 900px)");
    if (!query) return;
    const change = () => setCompact(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <aside className="queue-panel">
      <h1>{t("title")}</h1>
      <FileDropZone
        icon={compact ? <Upload size={20} className="text-muted" aria-hidden /> : undefined}
        size="md"
        buttonVariant="primary"
        className={compact ? "compact-drop-zone" : "py-6"}
        onBrowse={onChoose}
        label={t(compact ? "dropHintCompact" : "dropHint")}
        aria-label={t("dropZone")}
        buttonLabel={t("chooseFiles")}
      />
      {items.length > 0 && (
        <header className="queue-heading">
          <h2>
            {headingBefore}
            <SwapText
              speed="fast"
              value={new Intl.NumberFormat(i18n.language).format(items.length)}
            />
            {headingAfter}
          </h2>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={t("clearHistoryTitle")}
            description={t("clearHistoryDescription", { count: items.length })}
            confirmLabel={t("clearHistory")}
            cancelLabel={t("cancel")}
            tone="danger"
            onConfirm={() => {
              onClear();
              setConfirmOpen(false);
            }}
          >
            <IconButton label={t("clearHistory")}>
              <BrushCleaning size={compact ? 15 : 16} aria-hidden="true" />
            </IconButton>
          </ConfirmDialog>
        </header>
      )}
      {items.length === 0 ? (
        <p className="text-muted">{t("emptyQueue")}</p>
      ) : (
        <ul
          className="queue-list"
          aria-label={t("queue")}
          aria-live="polite"
          aria-relevant="text additions"
        >
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={onSelect}
              onCancel={onCancel}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

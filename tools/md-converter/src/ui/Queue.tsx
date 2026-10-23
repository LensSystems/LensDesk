import { BrushCleaning, ConfirmDialog, FileDropZone, IconButton } from "@lensdesk/ui";
import { useState } from "react";
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
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <aside className="queue-panel">
      <h1>{t("title")}</h1>
      <FileDropZone
        size="md"
        buttonVariant="primary"
        className="py-6"
        onBrowse={onChoose}
        label={t("dropHint")}
        aria-label={t("dropZone")}
        buttonLabel={t("chooseFiles")}
      />
      {items.length > 0 && (
        <header className="queue-heading">
          <h2>{t("historyHeading", { count: items.length })}</h2>
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
              <BrushCleaning size={16} aria-hidden="true" />
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

import { FileDropZone } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { QueueCard } from "./QueueCard.tsx";
import type { QueueItem } from "./use-queue.ts";

export function Queue({
  items,
  selectedId,
  onChoose,
  onSelect,
  onCancel,
}: {
  items: QueueItem[];
  selectedId: string | null;
  onChoose: () => void;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className="queue-panel">
      <h1>{t("title")}</h1>
      <FileDropZone
        size={items.length ? "compact" : "md"}
        buttonVariant="primary"
        className={items.length ? undefined : "py-6"}
        onBrowse={onChoose}
        label={t(items.length ? "dropMore" : "dropHint")}
        aria-label={t("dropZone")}
        buttonLabel={t("chooseFiles")}
      />
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

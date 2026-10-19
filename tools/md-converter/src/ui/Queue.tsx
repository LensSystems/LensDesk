import { Button, FileDropZone } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { StatusText } from "./StatusText.tsx";
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
  const { t, i18n } = useTranslation();
  const percent = new Intl.NumberFormat(i18n.language, { style: "percent" });

  return (
    <section className="queue-panel">
      <FileDropZone
        onBrowse={onChoose}
        label={t("dropHint")}
        aria-label={t("dropZone")}
        buttonLabel={t("chooseFiles")}
      />
      {items.length === 0 ? (
        <p className="muted">{t("emptyQueue")}</p>
      ) : (
        <ul className="queue-list" aria-label={t("queue")}>
          {items.map((item) => (
            <li
              key={item.id}
              className={item.id === selectedId ? "queue-row selected" : "queue-row"}
            >
              <div className="queue-row-head">
                <Button
                  type="button"
                  className="queue-name"
                  aria-pressed={item.id === selectedId}
                  disabled={item.status !== "done"}
                  onClick={() => onSelect(item.id)}
                >
                  {item.file.name}
                </Button>
                {(item.status === "queued" || item.status === "converting") && (
                  <Button
                    type="button"
                    aria-label={t("cancelFile", { name: item.file.name })}
                    onClick={() => onCancel(item.id)}
                  >
                    {t("cancel")}
                  </Button>
                )}
              </div>
              <div className="queue-row-status">
                <progress
                  aria-label={t("progressOf", { name: item.file.name })}
                  max={1}
                  value={item.progress}
                />
                <span className="muted">{percent.format(item.progress)}</span>
              </div>
              <StatusText item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

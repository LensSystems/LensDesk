import { useTranslation } from "react-i18next";
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
      <section className="drop-zone" aria-label={t("dropZone")}>
        <p className="muted">{t("dropHint")}</p>
        <button type="button" className="primary" onClick={onChoose}>
          {t("chooseFiles")}
        </button>
      </section>
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
                <button
                  type="button"
                  className="queue-name"
                  aria-pressed={item.id === selectedId}
                  disabled={item.status !== "done"}
                  onClick={() => onSelect(item.id)}
                >
                  {item.file.name}
                </button>
                {(item.status === "queued" || item.status === "converting") && (
                  <button
                    type="button"
                    aria-label={t("cancelFile", { name: item.file.name })}
                    onClick={() => onCancel(item.id)}
                  >
                    {t("cancel")}
                  </button>
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

function StatusText({ item }: { item: QueueItem }) {
  const { t } = useTranslation();
  if (item.status === "error" || item.status === "cancelled")
    return (
      <p className={item.status === "error" ? "row-error" : "muted"}>
        {t(`errors.${item.errorCode}`, {
          defaultValue: t("errors.generic", { code: item.errorCode }),
        })}
      </p>
    );
  return (
    <>
      <p className="muted">{t(`status.${item.status}`)}</p>
      {item.status === "done" && item.warnings.length > 0 && (
        <p className="row-warning">{t("imagesOmitted")}</p>
      )}
    </>
  );
}

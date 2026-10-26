import { Badge, Check, CircleAlert, IconButton, ListItem, Save, SwapText, X } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { QueueFilename } from "./QueueFilename.tsx";
import { StatusText } from "./StatusText.tsx";
import type { QueueItem } from "./use-queue.ts";

export function QueueCard({
  item,
  selected,
  onSelect,
  onCancel,
}: {
  item: QueueItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const active = item.status === "queued" || item.status === "converting";
  const progress = Math.round(item.progress * 100);
  return (
    <li className="min-w-0">
      <ListItem
        variant="card"
        title={<QueueFilename name={item.file.name} />}
        aria-label={item.file.name}
        selected={selected}
        disabled={item.status !== "done"}
        onClick={() => onSelect(item.id)}
        containerClassName={`queue-card ${selected ? "queue-card-selected" : ""} ${item.status === "error" ? "border-danger bg-danger-soft" : ""}`}
        actions={
          <>
            <span className={active ? "queue-status" : "queue-result-status"}>
              {!active && (item.status === "done" || item.status === "error") && (
                <span
                  className={`compact-icon ${item.status === "done" ? "text-success" : "text-danger"}`}
                  role="img"
                  aria-label={t(`status.${item.status}`)}
                >
                  {item.status === "done" ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <CircleAlert size={15} aria-hidden="true" />
                  )}
                </span>
              )}
              <SwapText
                key="status"
                align="end"
                value={t(`status.${item.status}`)}
                wrap={(content) =>
                  active ? (
                    <span>{content}</span>
                  ) : (
                    <Badge
                      className="normal-status"
                      tone={
                        item.status === "done"
                          ? "accent"
                          : item.status === "error"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {content}
                    </Badge>
                  )
                }
              />
              {item.status === "converting" && (
                <span>
                  {new Intl.NumberFormat(i18n.language, { style: "percent" }).format(item.progress)}
                </span>
              )}
              {item.status === "done" && item.saved && (
                <span className="saved-indicator" role="img" aria-label={t("fileSaved")}>
                  <Save size={16} aria-hidden="true" />
                  <Check size={8} className="saved-check" aria-hidden="true" />
                </span>
              )}
            </span>
            {active && (
              <IconButton
                tooltip={false}
                label={t("cancelFile", { name: item.file.name })}
                onClick={() => onCancel(item.id)}
              >
                <X size={14} aria-hidden="true" />
              </IconButton>
            )}
          </>
        }
        footer={
          item.status === "converting" ? (
            <div
              className="queue-progress"
              role="progressbar"
              aria-label={t("progressOf", { name: item.file.name })}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${progress}%` }} />
            </div>
          ) : item.status === "error" || item.status === "cancelled" ? (
            <StatusText item={item} />
          ) : undefined
        }
      />
    </li>
  );
}

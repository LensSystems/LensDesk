import { IconButton, ListItem, X } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { QueueFilename } from "./QueueFilename.tsx";
import { QueueState } from "./QueueState.tsx";
import { StatusText } from "./StatusText.tsx";
import { useCompletionMotion } from "./use-completion-motion.ts";
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
  const { t } = useTranslation();
  const { motion, clearMotion, root } = useCompletionMotion(item);
  const active = item.status === "queued" || item.status === "converting";
  const progress = Math.round(item.progress * 100);
  return (
    <li ref={root} className="min-w-0 fila-conversion">
      {motion.old?.status === "converting" && (
        <div
          className="progreso-saliente queue-progress"
          style={motion.bar ? { inset: "auto", ...motion.bar } : undefined}
          aria-hidden="true"
          inert
        >
          <div style={{ width: `${Math.round(motion.old.progress * 100)}%` }} />
        </div>
      )}
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
            <QueueState
              item={item}
              motion={motion.done}
              savedMotion={motion.saved}
              onEnd={clearMotion}
            />
            {motion.old && (
              <span className="estado-saliente" aria-hidden="true" inert>
                <QueueState item={motion.old} />
              </span>
            )}
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

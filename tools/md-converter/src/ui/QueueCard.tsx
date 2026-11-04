import { IconButton, keyboardFocus, ListItem, X } from "@lensdesk/ui";
import { useState } from "react";
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
  // Cambiar de foco no debe mover los botones de esta fila ni de las que están debajo.
  const [expanded, setExpanded] = useState(false);
  const active = item.status === "queued" || item.status === "converting";
  const unavailable = item.status !== "done";
  const progress = Math.round(item.progress * 100);
  return (
    <li
      ref={root}
      className="min-w-0 fila-conversion"
      data-filename-expanded={expanded}
      onFocusCapture={(event) => {
        if (keyboardFocus(event.target)) setExpanded(true);
      }}
      tabIndex={unavailable ? 0 : undefined}
      aria-label={unavailable ? `${item.file.name}, ${t(`status.${item.status}`)}` : undefined}
    >
      {motion.old?.status === "converting" && (
        <div
          className="progreso-saliente queue-progress"
          // La tarjeta «Listo» es más baja: la barra no baja de su borde para no alargar la lista.
          style={
            motion.bar
              ? {
                  inset: "auto",
                  left: motion.bar.left,
                  width: motion.bar.width,
                  top: `min(${motion.bar.top}px, calc(100% - 6px))`,
                }
              : undefined
          }
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
        disabled={unavailable}
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

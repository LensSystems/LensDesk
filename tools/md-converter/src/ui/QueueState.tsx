import { Badge, Check, CircleAlert, Save, SwapText } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { QueueItem } from "./use-queue.ts";

export function QueueState({
  item,
  motion = false,
  savedMotion = false,
  onEnd,
}: {
  item: QueueItem;
  motion?: boolean;
  savedMotion?: boolean;
  onEnd?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const active = item.status === "queued" || item.status === "converting";
  return (
    <span
      data-motion={motion ? "on" : undefined}
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget ||
          (event.target as Element).classList.contains("saved-indicator")
        )
          onEnd?.();
      }}
      className={active ? "queue-status" : "queue-result-status"}
    >
      {!active && (item.status === "done" || item.status === "error") && (
        <span
          className={`compact-icon ${item.status === "done" ? "text-success" : "text-danger"}`}
          role="img"
          aria-label={t(`status.${item.status}`)}
        >
          {item.status === "done" ? (
            <Check
              ref={(node) => node?.querySelector("path, polyline")?.setAttribute("pathLength", "1")}
              size={15}
              aria-hidden="true"
            />
          ) : (
            <CircleAlert size={15} aria-hidden="true" />
          )}
        </span>
      )}
      <SwapText
        className={motion ? "estado-listo" : undefined}
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
                item.status === "done" ? "accent" : item.status === "error" ? "danger" : "neutral"
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
        <span
          data-motion={savedMotion ? "on" : undefined}
          className="saved-indicator"
          role="img"
          aria-label={t("fileSaved")}
        >
          <Save size={16} aria-hidden="true" />
          <Check
            ref={(node) => node?.querySelector("path, polyline")?.setAttribute("pathLength", "1")}
            size={8}
            className="saved-check"
            aria-hidden="true"
          />
        </span>
      )}
    </span>
  );
}

import { useTranslation } from "react-i18next";
import type { QueueItem } from "./use-queue.ts";

export function StatusText({ item }: { item: QueueItem }) {
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

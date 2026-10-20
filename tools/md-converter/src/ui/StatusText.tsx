import { useTranslation } from "react-i18next";
import type { QueueItem } from "./use-queue.ts";

export function StatusText({ item }: { item: QueueItem }) {
  const { t } = useTranslation();
  return (
    <p className={item.status === "error" ? "text-[13px] text-danger" : "text-xs text-muted"}>
      {t(`errors.${item.errorCode}`, {
        defaultValue: t("errors.generic", { code: item.errorCode }),
      })}
    </p>
  );
}

import { Notice } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { OperationFeedback } from "./types.ts";

export function DialogFeedback({
  operation,
  savedDraft,
}: {
  operation: OperationFeedback;
  savedDraft: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {savedDraft ? <p role="status">{t("savedPreviousDraft")}</p> : null}
      {operation.issue ? (
        <Notice
          tone="danger"
          title={t(`errors.${operation.issue}`, { defaultValue: t("errors.E_INTERNAL") })}
          action={
            !operation.writing && !operation.loading
              ? {
                  label: t(operation.pendingConfirmation ? "retryOperation" : "retry"),
                  onClick: operation.retry,
                }
              : undefined
          }
        />
      ) : null}
    </>
  );
}

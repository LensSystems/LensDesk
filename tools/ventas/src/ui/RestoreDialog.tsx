import { Button, DialogContent, DialogDescription, DialogTitle } from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PreparedBackup } from "../shared/backup-contracts.ts";
import { BackupPreview } from "./BackupPreview.tsx";
import { DialogFeedback } from "./DialogFeedback.tsx";
import type { RunRestore, ScreenProps } from "./types.ts";
export function RestoreDialog({
  preview,
  restore,
  close,
  ...props
}: ScreenProps & { preview: PreparedBackup; restore: RunRestore; close: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  const { t } = useTranslation(),
    [owner] = useState(() => crypto.randomUUID()),
    [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted && props.operation.confirmedOwner === owner && !props.operation.writing) close();
  }, [submitted, props.operation.confirmedOwner, props.operation.writing, owner, close]);
  const stale =
    preview.revision !== props.data.revision || props.operation.invalidRestoreId === preview.id;
  return (
    <DialogContent
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        title.current?.focus();
      }}
    >
      <DialogTitle ref={title} tabIndex={-1}>
        {t("restoreBackup")}
      </DialogTitle>
      <DialogDescription>{t("restoreWarning")}</DialogDescription>
      <BackupPreview preview={preview} />
      <DialogFeedback operation={props.operation} savedDraft={false} />
      {stale ? <p role="alert">{t("backupStale")}</p> : null}
      {props.operation.writing ? (
        <>
          <p role="status">
            {t("backupProgress", { percent: Math.round((props.operation.progress ?? 0) * 100) })}
          </p>
          <Button onClick={props.operation.cancel}>{t("cancelBackup")}</Button>
        </>
      ) : null}
      <Button
        variant="primary"
        disabled={props.busy || stale || (submitted && props.operation.confirmedOwner === owner)}
        onClick={() => {
          setSubmitted(true);
          void restore(preview, owner);
        }}
      >
        {t("confirmRestore")}
      </Button>
    </DialogContent>
  );
}

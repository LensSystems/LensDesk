import { Button, Dialog, DialogTrigger, Notice } from "@lensdesk/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  backupInfoSchema,
  type PreparedBackup,
  preparedSchema,
} from "../shared/backup-contracts.ts";
import { parseQueryResult } from "../shared/query-result.ts";
import { BackupPreview } from "./BackupPreview.tsx";
import { RestoreDialog } from "./RestoreDialog.tsx";
import type { Client, RunRestore, ScreenProps } from "./types.ts";
import { useQuery } from "./use-query.ts";
export function BackupPanel({
  client,
  restore,
  ...props
}: ScreenProps & { client: Client; restore: RunRestore }) {
  const { t } = useTranslation(),
    [preview, setPreview] = useState<PreparedBackup | null>(null),
    [open, setOpen] = useState(false),
    [working, setWorking] = useState(false),
    [issue, setIssue] = useState<string | null>(null),
    [status, setStatus] = useState<string | null>(null),
    [progress, setProgress] = useState(0),
    controller = useRef<AbortController | null>(null);
  const info = useQuery(props.read, "backupInfo", {}, backupInfoSchema, props.data.revision);
  async function choose() {
    setWorking(true);
    setIssue(null);
    setStatus(null);
    setPreview(null);
    try {
      const files = await client.files.pickOpen({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      const file = files[0];
      if (!file) return;
      controller.current = new AbortController();
      const result = parseQueryResult(
        preparedSchema,
        await client.backend.invoke(
          "backupPrepare",
          { token: file.token, name: file.name },
          { signal: controller.current.signal, onProgress: (e) => setProgress(e.fraction) },
        ),
      );
      if (result.kind === "rejected") setIssue(result.issue.code);
      else setPreview(result.value);
    } catch (e) {
      setIssue(errorCode(e));
    } finally {
      controller.current = null;
      setWorking(false);
      setProgress(0);
    }
  }
  async function save(previous = false) {
    setWorking(true);
    setIssue(null);
    setStatus(null);
    try {
      const file = await client.files.pickSave({
        defaultName: previous ? "ventas-copia-previa.json" : "ventas-respaldo.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file) return;
      controller.current = new AbortController();
      const result = parseQueryResult(
        z.strictObject({ bytes: z.number().int(), hash: z.string() }),
        await client.backend.invoke(
          "backupExport",
          { token: file.token, previous },
          { signal: controller.current.signal, onProgress: (e) => setProgress(e.fraction) },
        ),
      );
      if (result.kind === "rejected") setIssue(result.issue.code);
      else setStatus("backupSaved");
    } catch (e) {
      setIssue(errorCode(e));
    } finally {
      controller.current = null;
      setWorking(false);
      setProgress(0);
    }
  }
  const disabled = props.busy || working;
  return (
    <section className="grid gap-4 border-t border-border pt-6">
      <h2>{t("backupTitle")}</h2>
      <p>{t("backupIntro")}</p>
      {issue ? (
        <Notice
          tone="danger"
          title={t(`errors.${issue}`, { defaultValue: t("errors.E_INTERNAL") })}
        />
      ) : null}
      {status ? <p role="status">{t(status)}</p> : null}
      {working ? (
        <>
          <p role="status">{t("backupProgress", { percent: Math.round(progress * 100) })}</p>
          <Button onClick={() => controller.current?.abort()}>{t("cancelBackup")}</Button>
        </>
      ) : null}
      <div className="ventas-row-actions">
        <Button disabled={disabled} onClick={() => void save()}>
          {t("exportBackup")}
        </Button>
        <Button disabled={disabled} onClick={() => void choose()}>
          {t("chooseBackup")}
        </Button>
        {info.value?.previous ? (
          <Button disabled={disabled} onClick={() => void save(true)}>
            {t("downloadPrevious")}
          </Button>
        ) : null}
      </div>
      {preview ? (
        <>
          <BackupPreview preview={preview} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>{t("restoreBackup")}</Button>
            </DialogTrigger>
            {open ? (
              <RestoreDialog
                {...props}
                busy={props.busy || working}
                preview={preview}
                restore={restore}
                close={() => {
                  setOpen(false);
                  setStatus("restoreConfirmed");
                }}
              />
            ) : null}
          </Dialog>
          {preview.revision !== props.data.revision ? <p>{t("backupStale")}</p> : null}
        </>
      ) : null}
      <p className="text-muted">{t("backupPrivacy")}</p>
    </section>
  );
}
function errorCode(e: unknown): string {
  return typeof e === "object" && e && "code" in e ? String(e.code) : "E_INTERNAL";
}

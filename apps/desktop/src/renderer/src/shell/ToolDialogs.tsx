import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@lensdesk/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge, PendingDowngrade, ToolSummary } from "../../../shared/host-channels.ts";
import { toolText } from "./tool-name.ts";

export type ToolDialogState =
  | { kind: "details" | "remove"; tool: ToolSummary }
  | { kind: "error"; code: string; install: boolean }
  | null;
export function ToolDialogs({
  state,
  pending,
  bridge,
  onClose,
  onError,
}: {
  state: ToolDialogState;
  pending: PendingDowngrade | null;
  bridge: HostBridge;
  onClose: () => void;
  onError: (code: string, install: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [deleteData, setDeleteData] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  useEffect(() => {
    setDowngradeOpen(Boolean(pending));
  }, [pending]);
  // Cada confirmación de quitar empieza con la casilla desmarcada.
  useEffect(() => {
    if (state?.kind === "remove") setDeleteData(false);
  }, [state]);
  const tool = state && "tool" in state ? state.tool : undefined;
  const name = tool ? toolText(tool, i18n.resolvedLanguage).name : "";
  const permissions = (tool?.manifest as { permissions?: string[] } | undefined)?.permissions ?? [];
  const remove = async (toolId: string) => {
    onClose();
    const result = await bridge.invoke("tools.remove", { toolId, deleteData });
    if (!result.ok) onError(result.error.code, false);
  };
  const confirmDowngrade = async (target: PendingDowngrade) => {
    setDowngradeOpen(false);
    const result = await bridge.invoke("tools.confirmDowngrade", {
      toolId: target.toolId,
      version: target.version,
    });
    if (!result.ok) onError(result.error.code, true);
  };
  return (
    <>
      <Dialog
        open={Boolean(state)}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent>
          {state?.kind === "details" && tool && (
            <>
              <DialogTitle>{t("toolsPage.detailsTitle", { name })}</DialogTitle>
              <DialogDescription>
                {t("toolsPage.version")}: {tool.version}
                <br />
                {t(tool.signed ? "toolsPage.signed" : "toolsPage.unsigned")}
                <br />
                {t("toolsPage.permissions")}:{" "}
                {permissions.length > 0
                  ? permissions.map((p) => t(`toolsPage.permission.${p}`)).join(", ")
                  : t("toolsPage.noPermissions")}
              </DialogDescription>
              <Button onClick={onClose}>{t("ui.close")}</Button>
            </>
          )}
          {state?.kind === "remove" && tool && (
            <>
              <DialogTitle>{t("toolsPage.removeTitle", { name })}</DialogTitle>
              <DialogDescription>{t("toolsPage.removeDescription")}</DialogDescription>
              <label htmlFor="delete-tool-data" className="my-3 flex items-center gap-2">
                <Checkbox
                  id="delete-tool-data"
                  checked={deleteData}
                  onCheckedChange={setDeleteData}
                />
                {t("toolsPage.deleteData")}
              </label>
              <Button onClick={() => void remove(tool.id)}>{t("toolsPage.remove")}</Button>
            </>
          )}
          {state?.kind === "error" && (
            <>
              <DialogTitle>
                {t(state.install ? "toolsPage.installError" : "toolsPage.actionError")}
              </DialogTitle>
              <DialogDescription>
                {t(`errors.${state.code}`, { defaultValue: t("errors.E_INTERNAL") })}
              </DialogDescription>
              <Button onClick={onClose}>{t("ui.close")}</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={downgradeOpen} onOpenChange={setDowngradeOpen}>
        <DialogContent>
          <DialogTitle>{t("toolsPage.downgradeTitle")}</DialogTitle>
          <DialogDescription>
            {pending &&
              t("toolsPage.downgradeDescription", {
                installed: pending.installedVersion,
                incoming: pending.version,
              })}
          </DialogDescription>
          <div className="flex gap-2">
            <Button onClick={() => setDowngradeOpen(false)}>{t("toolsPage.cancel")}</Button>
            <Button onClick={() => pending && void confirmDowngrade(pending)}>
              {t("toolsPage.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

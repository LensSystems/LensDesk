import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  TriangleAlert,
} from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HostBridge, PendingDowngrade, ToolSummary } from "../../../shared/host-channels.ts";
import { ToolDowngradeDialog } from "./ToolDowngradeDialog.tsx";
import { ToolUpdateActions } from "./ToolUpdateActions.tsx";
import { toolIcon } from "./tool-icons.ts";
import { toolText } from "./tool-name.ts";
export type ToolDialogState =
  | { kind: "details" | "remove"; tool: ToolSummary; returnFocus?: HTMLElement }
  | { kind: "error"; code: string; install: boolean }
  | null;
export function ToolDialogs({
  state,
  update,
  onInstall,
  pending,
  bridge,
  onClose,
  onError,
}: {
  update?: import("../../../shared/host-channels.ts").ToolUpdate;
  onInstall?: () => void;
  state: ToolDialogState;
  pending: PendingDowngrade | null;
  bridge: HostBridge;
  onClose: () => void;
  onError: (code: string, install: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [deleteData, setDeleteData] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | undefined>(undefined);
  if (state) returnFocus.current = "tool" in state ? state.returnFocus : undefined;
  useEffect(() => {
    setDowngradeOpen(Boolean(pending));
  }, [pending]);
  useEffect(() => {
    if (state?.kind === "remove") setDeleteData(false);
  }, [state]);
  const tool = state && "tool" in state ? state.tool : undefined;
  const name = tool ? toolText(tool, i18n.resolvedLanguage).name : "";
  const ToolIcon = toolIcon((tool?.manifest as { icon?: unknown } | undefined)?.icon);
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
        <DialogContent
          {...(state?.kind === "details" ? { "aria-describedby": undefined } : {})}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          {state?.kind === "details" && tool && (
            <>
              <div className="flex items-center gap-3 pr-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-ld-md bg-accent-soft text-accent-soft-fg">
                  <ToolIcon aria-hidden size={20} />
                </div>
                <DialogTitle>{t("toolsPage.detailsTitle", { name })}</DialogTitle>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted">{t("toolsPage.version")}</dt>
                <dd className="ld-selectable font-mono text-text">{tool.version}</dd>
                <dt className="text-muted">{t("toolsPage.signature")}</dt>
                <dd className="text-text">
                  <Badge tone={tool.signed ? "accent" : "warning"}>
                    {t(tool.signed ? "toolsPage.signed" : "toolsPage.unsigned")}
                  </Badge>
                </dd>
                <dt className="text-muted">{t("toolsPage.permissions")}</dt>
                <dd className="flex flex-wrap gap-2 text-text">
                  {permissions.length > 0
                    ? permissions.map((permission) => (
                        <Badge key={permission} tone="neutral">
                          {t(`toolsPage.permission.${permission}`)}
                        </Badge>
                      ))
                    : t("toolsPage.noPermissions")}
                </dd>
              </dl>
              <ToolUpdateActions update={update} bridge={bridge} onInstall={onInstall} />
              <div className="flex justify-end gap-2">
                <Button size="lg" onClick={onClose}>
                  {t("ui.close")}
                </Button>
              </div>
            </>
          )}
          {state?.kind === "remove" && tool && (
            <>
              <DialogTitle>{t("toolsPage.removeTitle", { name })}</DialogTitle>
              <DialogDescription className="text-muted">
                {t("toolsPage.removeDescription")}
              </DialogDescription>
              <label
                htmlFor="delete-tool-data"
                className="flex cursor-pointer items-center gap-3 rounded-ld-md border border-border bg-surface p-3 font-semibold"
              >
                <Checkbox
                  id="delete-tool-data"
                  checked={deleteData}
                  onCheckedChange={setDeleteData}
                />
                {t("toolsPage.deleteData")}
              </label>
              <div className="flex justify-end gap-2">
                <Button size="lg" onClick={onClose}>
                  {t("toolsPage.cancel")}
                </Button>
                <Button size="lg" variant="danger" onClick={() => void remove(tool.id)}>
                  {t("toolsPage.remove")}
                </Button>
              </div>
            </>
          )}
          {state?.kind === "error" && (
            <>
              <div className="flex items-center gap-3 pr-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-ld-md bg-danger-soft text-danger">
                  <TriangleAlert aria-hidden size={20} />
                </div>
                <DialogTitle>
                  {t(state.install ? "toolsPage.installError" : "toolsPage.actionError")}
                </DialogTitle>
              </div>
              <DialogDescription className="ld-selectable text-muted">
                {t(`errors.${state.code}`, { defaultValue: t("errors.E_INTERNAL") })}
              </DialogDescription>
              <dl>
                <dt className="sr-only">{t("toolsPage.errorCode")}</dt>
                <dd>
                  <code className="ld-selectable rounded-ld-sm bg-surface px-2 py-1 font-mono text-xs">
                    {state.code}
                  </code>
                </dd>
              </dl>
              <div className="flex justify-end gap-2">
                <Button size="lg" onClick={onClose}>
                  {t("ui.close")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ToolDowngradeDialog
        open={downgradeOpen}
        onOpenChange={setDowngradeOpen}
        pending={pending}
        onConfirm={confirmDowngrade}
      />
    </>
  );
}

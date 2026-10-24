import {
  Badge,
  Ban,
  Button,
  CircleCheck,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Info,
  MoreHorizontal,
  Trash2,
} from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HostBridge, ToolSummary, ToolUpdate } from "../../../shared/host-channels.ts";
import { ToolUpdateActions } from "./ToolUpdateActions.tsx";
import { toolIcon } from "./tool-icons.ts";
import { toolText } from "./tool-name.ts";

type Actions = { enabled: () => void; details: () => void; remove: () => void };
export function ToolCard({
  tool,
  update,
  onOpen,
  actions,
  bridge,
  onInstall,
}: {
  tool: ToolSummary;
  update?: ToolUpdate;
  onOpen: () => void;
  actions: Actions;
  bridge: HostBridge;
  onInstall: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { name, description } = toolText(tool, i18n.resolvedLanguage);
  const Icon = toolIcon((tool.manifest as { icon?: unknown }).icon);
  const EnabledIcon = tool.enabled ? Ban : CircleCheck;
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-ld-lg border bg-surface ${tool.enabled ? "border-border" : "border-dashed border-border-control"}`}
    >
      <div
        className={`flex flex-1 flex-col gap-3 min-[900px]:gap-4 px-5 pt-5 ${update ? "pb-3 min-[900px]:pb-4" : "pb-5"}`}
      >
        <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-3 @min-[48rem]:grid-cols-[auto_1fr_auto]">
          <div
            className={`grid size-11 shrink-0 place-items-center rounded-ld-md ${tool.enabled ? "bg-accent-soft text-accent-soft-fg" : "bg-bg text-muted"}`}
          >
            <Icon aria-hidden size={20} />
          </div>
          <div className="col-span-2 row-start-2 min-w-0 @min-[48rem]:col-span-1 @min-[48rem]:col-start-2 @min-[48rem]:row-start-1">
            <h2
              className={`truncate text-base font-bold ${tool.enabled ? "text-text" : "text-muted"}`}
            >
              {name}
            </h2>
            <p
              title={tool.enabled ? description : t("toolsPage.disabledDescription")}
              className="truncate text-[13px] leading-5 text-muted"
            >
              {tool.enabled ? description : t("toolsPage.disabledDescription")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("toolsPage.actions", { name })}>
                <MoreHorizontal aria-hidden size={16} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2" onSelect={actions.details}>
                <Info aria-hidden size={15} />
                {t("toolsPage.details")}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={actions.enabled}>
                <EnabledIcon aria-hidden size={15} />
                {tool.enabled ? t("toolsPage.disable") : t("toolsPage.enable")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive className="gap-2" onSelect={actions.remove}>
                <Trash2 aria-hidden size={15} />
                {t("toolsPage.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="w-20 min-[900px]:w-24"
            disabled={!tool.enabled}
            onClick={onOpen}
            aria-label={t("toolsPage.openTool", { name })}
          >
            {t("toolsPage.open")}
          </Button>
          <span className="ld-selectable min-w-0 break-all text-xs text-muted @min-[48rem]:ml-auto">
            {t("toolsPage.cardVersion", { version: tool.version })}
          </span>
          <Badge tone={tool.signed ? "accent" : "warning"}>
            {t(tool.signed ? "toolsPage.signed" : "toolsPage.unsigned")}
          </Badge>
        </div>
      </div>
      {update && (
        <div className="ld-tool-update mt-auto">
          <div>
            <ToolUpdateActions update={update} bridge={bridge} onInstall={onInstall} />
          </div>
        </div>
      )}
    </article>
  );
}

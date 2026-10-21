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
import type { ToolSummary, ToolUpdate } from "../../../shared/host-channels.ts";
import { toolIcon } from "./tool-icons.ts";
import { toolText } from "./tool-name.ts";

type Actions = { enabled: () => void; details: () => void; remove: () => void };
export function ToolCard({
  tool,
  update,
  onOpen,
  actions,
}: {
  tool: ToolSummary;
  update?: ToolUpdate;
  onOpen: () => void;
  actions: Actions;
}) {
  const { t, i18n } = useTranslation();
  const { name, description } = toolText(tool, i18n.resolvedLanguage);
  const Icon = toolIcon((tool.manifest as { icon?: unknown }).icon);
  const EnabledIcon = tool.enabled ? Ban : CircleCheck;
  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-ld-lg border bg-surface p-5 ${tool.enabled ? "border-border" : "border-dashed border-border-control"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`grid size-11 shrink-0 place-items-center rounded-ld-md ${tool.enabled ? "bg-accent-soft text-accent-soft-fg" : "bg-bg text-muted"}`}
        >
          <Icon aria-hidden size={22} />
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
      <div className="min-w-0 space-y-1">
        <h2 className={`truncate text-base font-bold ${tool.enabled ? "text-text" : "text-muted"}`}>
          {name}
        </h2>
        <p className="line-clamp-2 text-muted">
          {tool.enabled ? description : t("toolsPage.disabledDescription")}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button
          disabled={!tool.enabled}
          onClick={onOpen}
          aria-label={t("toolsPage.openTool", { name })}
        >
          {t("toolsPage.open")}
        </Button>
        {update && (
          <Button onClick={actions.details}>
            {t("toolsPage.updateTo", { version: update.version })}
          </Button>
        )}
        <span className="ld-selectable min-w-0 break-all text-xs text-muted">
          {t("toolsPage.cardVersion", { version: tool.version })}
        </span>
        <Badge tone={tool.signed ? "accent" : "warning"}>
          {t(tool.signed ? "toolsPage.signed" : "toolsPage.unsigned")}
        </Badge>
      </div>
    </article>
  );
}

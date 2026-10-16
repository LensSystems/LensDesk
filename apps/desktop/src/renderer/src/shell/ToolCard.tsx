import { MoreHorizontal } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ToolSummary } from "../../../shared/host-channels.ts";
import { Badge } from "../components/ui/Badge.tsx";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu.tsx";
import { toolIcon } from "./tool-icons.ts";
import { toolText } from "./tool-name.ts";

type Actions = { enabled: () => void; details: () => void; remove: () => void };
export function ToolCard({
  tool,
  onOpen,
  actions,
}: {
  tool: ToolSummary;
  onOpen: () => void;
  actions: Actions;
}) {
  const { t, i18n } = useTranslation();
  const { name, description } = toolText(tool, i18n.resolvedLanguage);
  const nameId = useId();
  const descriptionId = useId();
  const Icon = toolIcon((tool.manifest as { icon?: unknown }).icon);
  return (
    <article
      className={`relative rounded-md border border-border bg-surface-raised p-3 ${tool.enabled ? "" : "opacity-50"}`}
    >
      <button
        type="button"
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={nameId}
        disabled={!tool.enabled}
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded text-left"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span className="min-w-0">
          <span className="block font-medium" id={nameId}>
            {name}
          </span>
          <span className="mt-1 block text-xs text-muted" id={descriptionId}>
            {description}
          </span>
        </span>
      </button>
      {!tool.signed && <Badge className="mt-2">{t("toolsPage.unsigned")}</Badge>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("toolsPage.actions", { name })}
            className="absolute right-2 top-2 rounded p-1 text-muted"
          >
            <MoreHorizontal aria-hidden="true" size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={actions.enabled}>
            {tool.enabled ? t("toolsPage.disable") : t("toolsPage.enable")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.details}>{t("toolsPage.details")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.remove}>{t("toolsPage.remove")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

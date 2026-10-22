import {
  ChevronDown,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Redo2,
  Type,
  Undo2,
} from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { Format } from "./markdown-commands.ts";

export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFormat,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFormat: (format: Format) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="absolute right-4 top-2 z-10 flex items-center rounded-ld-md border border-border bg-surface-raised p-1">
      <IconButton
        label={t("undo")}
        disabled={!canUndo}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onUndo}
      >
        <Undo2 aria-hidden="true" className="size-4" />
      </IconButton>
      <IconButton
        label={t("redo")}
        disabled={!canRedo}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRedo}
      >
        <Redo2 aria-hidden="true" className="size-4" />
      </IconButton>
      <span aria-hidden="true" className="mx-1 h-4 border-l border-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={t("format")}>
            <Type aria-hidden="true" className="size-4" />
            <ChevronDown aria-hidden="true" className="size-3" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
          {(["bold", "italic", "underline", "strike", "code", "link"] as const).map((format) => (
            <DropdownMenuItem key={format} onSelect={() => onFormat(format)}>
              {t(`formatting.${format}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

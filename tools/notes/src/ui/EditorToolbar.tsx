import {
  ChevronDown,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Redo2,
  Undo2,
} from "@lensdesk/ui";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { editorShortcut } from "./editor-shortcut.ts";
import { FormatGlyph } from "./FormatGlyph.tsx";
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
    <div className="absolute right-4 top-[9px] z-10 flex items-center gap-0.5 rounded-full border border-border bg-surface-raised p-[3px] shadow-ld">
      <IconButton
        label={t("undo")}
        disabled={!canUndo}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onUndo}
      >
        <Undo2 aria-hidden="true" className="size-[15px]" strokeWidth={2} />
      </IconButton>
      <IconButton
        label={t("redo")}
        disabled={!canRedo}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRedo}
      >
        <Redo2 aria-hidden="true" className="size-[15px]" strokeWidth={2} />
      </IconButton>
      <span aria-hidden="true" className="mx-1 h-[18px] w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            label={t("format")}
            className="h-7 w-auto gap-1 bg-border pl-2.5 pr-2 text-text hover:bg-border hover:text-text"
          >
            <span aria-hidden="true" className="text-sm font-bold">
              {t("formatSymbol")}
            </span>
            <ChevronDown aria-hidden="true" className="size-3" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[244px]"
          align="end"
          alignOffset={-4}
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {(["bold", "italic", "underline", "strike", "code", "link"] as const).map((format) => (
            <Fragment key={format}>
              {format === "link" && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => onFormat(format)}>
                <span
                  aria-hidden="true"
                  className="flex w-[18px] shrink-0 items-center justify-center text-muted"
                >
                  <FormatGlyph format={format} />
                </span>
                <span>{t(`formatting.${format}`)}</span>
                <kbd className="ml-auto font-sans text-xs leading-[17.4px] font-normal text-muted">
                  {editorShortcut(t, format)}
                </kbd>
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

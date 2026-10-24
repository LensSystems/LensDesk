import {
  Button,
  Check,
  Copy,
  Eye,
  Lock,
  LockOpen,
  Pencil,
  SegmentedControl,
  Tooltip,
  Upload,
} from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Note } from "./NoteList.tsx";
import { NoteTitle } from "./NoteTitle.tsx";
export function EditorHeader({
  note,
  preview,
  locked,
  onPrivate,
  onMode,
  onBlur,
  onCopy,
  onExport,
  onRename,
}: {
  note: Note;
  preview: boolean;
  locked: boolean;
  onPrivate?: () => void;
  onMode: (preview: boolean) => void;
  onBlur: () => void;
  onCopy: () => Promise<boolean>;
  onExport: () => void;
  onRename: (title: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  return (
    <header className="editor-toolbar flex h-[57px] min-w-0 shrink-0 items-center gap-2 border-b border-border px-4 py-3 @max-[960px]/notes:h-[51px] @max-[960px]/notes:gap-1 @max-[960px]/notes:py-2 @max-[960px]/notes:pr-2">
      <NoteTitle title={note.title} onRename={onRename} />
      <Tooltip label={t(note.private ? "vault.remove" : "vault.makePrivate")}>
        <Button
          variant="ghost"
          className="size-8 shrink-0 p-0 text-muted"
          data-vault-trigger
          aria-label={t(note.private ? "vault.remove" : "vault.makePrivate")}
          aria-pressed={Boolean(note.private)}
          onClick={onPrivate}
        >
          {note.private ? (
            <Lock size={16} aria-hidden="true" />
          ) : (
            <LockOpen size={16} aria-hidden="true" />
          )}
        </Button>
      </Tooltip>
      <SegmentedControl
        aria-label={t("mode")}
        className="h-8 shrink-0 items-center p-0.5 @max-[960px]/notes:h-[34px] @max-[960px]/notes:border @max-[960px]/notes:border-border"
        itemClassName="h-7 px-3.5 font-normal data-[state=checked]:shadow-[0_1px_2px_rgb(0_0_0_/_0.25)] @max-[960px]/notes:w-8 @max-[960px]/notes:px-0"
        value={preview ? "preview" : "edit"}
        onValueChange={(value) => {
          onBlur();
          onMode(value === "preview");
        }}
        options={[
          {
            value: "edit",
            disabled: locked,
            label: (
              <Tooltip label={t("edit")}>
                <span className="flex items-center justify-center gap-1.5">
                  <Pencil size={13} aria-hidden="true" />
                  <span className="@max-[960px]/notes:sr-only">{t("edit")}</span>
                </span>
              </Tooltip>
            ),
          },
          {
            value: "preview",
            disabled: locked,
            label: (
              <Tooltip label={t("preview")}>
                <span className="flex items-center justify-center gap-1.5">
                  <Eye size={13} aria-hidden="true" />
                  <span className="@max-[960px]/notes:sr-only">{t("preview")}</span>
                </span>
              </Tooltip>
            ),
          },
        ]}
      />
      <Tooltip label={t(copied ? "copied" : "copyNote")}>
        <Button
          variant="ghost"
          className={copied ? "copy-confirmation" : "size-8 shrink-0 p-0 text-muted"}
          aria-label={t(copied ? "copied" : "copyNote")}
          type="button"
          disabled={locked}
          onClick={async () => {
            if (!(await onCopy())) return;
            setCopied(true);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied && <span>{t("copied")}</span>}
        </Button>
      </Tooltip>
      <Tooltip label={t("export")}>
        <Button
          className="shrink-0 @max-[960px]/notes:size-8 @max-[960px]/notes:p-0"
          aria-label={t("export")}
          type="button"
          disabled={locked}
          onClick={onExport}
        >
          <Upload size={16} aria-hidden="true" />
          <span className="@max-[960px]/notes:sr-only">{t("export")}</span>
        </Button>
      </Tooltip>
    </header>
  );
}

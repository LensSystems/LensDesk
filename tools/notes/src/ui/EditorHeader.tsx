import { Button, Copy, Eye, Lock, Pencil, SegmentedControl, Upload } from "@lensdesk/ui";
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
    <header className="editor-toolbar">
      <Button
        data-vault-trigger
        aria-label={t(note.private ? "vault.remove" : "vault.makePrivate")}
        aria-pressed={Boolean(note.private)}
        onClick={onPrivate}
      >
        <Lock size={14} aria-hidden="true" />
      </Button>
      <NoteTitle title={note.title} onRename={onRename} />
      <SegmentedControl
        aria-label={t("mode")}
        className="h-6 items-center p-0 [&>button]:h-6 [&>button]:px-2"
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
              <span className="flex items-center gap-1">
                <Pencil size={12} aria-hidden="true" />
                {t("edit")}
              </span>
            ),
          },
          {
            value: "preview",
            disabled: locked,
            label: (
              <span className="flex items-center gap-1">
                <Eye size={12} aria-hidden="true" />
                {t("preview")}
              </span>
            ),
          },
        ]}
      />
      <Button
        type="button"
        disabled={locked}
        onClick={async () => {
          if (!(await onCopy())) return;
          setCopied(true);
          clearTimeout(copyTimer.current);
          copyTimer.current = setTimeout(() => setCopied(false), 2000);
        }}
      >
        <Copy size={14} aria-hidden="true" />
        {t(copied ? "copied" : "copyNote")}
      </Button>
      <Button type="button" disabled={locked} onClick={onExport}>
        <Upload size={14} aria-hidden="true" />
        {t("export")}
      </Button>
    </header>
  );
}

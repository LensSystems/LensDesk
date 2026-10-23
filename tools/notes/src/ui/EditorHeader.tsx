import {
  Button,
  Check,
  Copy,
  Eye,
  Lock,
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
    <header className="editor-toolbar">
      <NoteTitle title={note.title} onRename={onRename} />
      <Tooltip label={t(note.private ? "vault.remove" : "vault.makePrivate")}>
        <Button
          variant="ghost"
          className="size-8 p-0 text-muted"
          data-vault-trigger
          aria-label={t(note.private ? "vault.remove" : "vault.makePrivate")}
          aria-pressed={Boolean(note.private)}
          onClick={onPrivate}
        >
          <Lock size={14} aria-hidden="true" />
        </Button>
      </Tooltip>
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
              <Tooltip label={t("edit")}>
                <span className="flex items-center gap-1">
                  <Pencil size={12} aria-hidden="true" />
                  <span className="compact-label">{t("edit")}</span>
                </span>
              </Tooltip>
            ),
          },
          {
            value: "preview",
            disabled: locked,
            label: (
              <Tooltip label={t("preview")}>
                <span className="flex items-center gap-1">
                  <Eye size={12} aria-hidden="true" />
                  <span className="compact-label">{t("preview")}</span>
                </span>
              </Tooltip>
            ),
          },
        ]}
      />
      <Tooltip label={t(copied ? "copied" : "copyNote")}>
        <Button
          variant="ghost"
          className={copied ? "copy-confirmation" : "size-8 p-0 text-muted"}
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
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied && <span>{t("copied")}</span>}
        </Button>
      </Tooltip>
      <Tooltip label={t("export")}>
        <Button aria-label={t("export")} type="button" disabled={locked} onClick={onExport}>
          <Upload size={14} aria-hidden="true" />
          <span className="compact-label">{t("export")}</span>
        </Button>
      </Tooltip>
    </header>
  );
}

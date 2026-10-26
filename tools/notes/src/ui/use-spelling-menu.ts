import type { EditorView } from "@codemirror/view";
import type { createToolClient, SpellingInfo } from "@lensdesk/sdk";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { replaceSpelling, type SpellingRange } from "./spelling-replace.ts";

type Point = { x: number; y: number };
type Pending = {
  point: Point;
  range: SpellingRange | null;
  cleanup: () => void;
  open: (point: Point) => void;
  timer: ReturnType<typeof setTimeout>;
  deadline: number;
};

export function useSpellingMenu(
  client: ReturnType<typeof createToolClient> | undefined,
  enabled: boolean,
  view: RefObject<EditorView | null>,
  readOnly: boolean,
) {
  const { t } = useTranslation();
  const pending = useRef<Pending | null>(null);
  const [spelling, setSpelling] = useState<{
    info: SpellingInfo;
    range: SpellingRange | null;
  } | null>(null);
  const cancel = useCallback(() => {
    const request = pending.current;
    pending.current = null;
    if (!request) return;
    clearTimeout(request.timer);
    request.cleanup();
  }, []);
  useEffect(() => {
    if (!enabled || !client) return cancel;
    const unsubscribe = client.app.onSpelling((info) => {
      const request = pending.current;
      if (!request || Date.now() >= request.deadline) return;
      cancel();
      setSpelling(info.word ? { info, range: request.range } : null);
      request.open(request.point);
    });
    return () => {
      unsubscribe();
      cancel();
    };
  }, [client, enabled, cancel]);
  return {
    onClose: () => {
      cancel();
      setSpelling(null);
      view.current?.focus();
    },
    onNativeContextMenu: enabled
      ? (point: Point, open: (point: Point) => void) => {
          cancel();
          const editor = view.current;
          const pos = editor?.posAtCoords(point);
          const wordRange = pos == null ? null : editor?.state.wordAt(pos);
          const range =
            editor && wordRange
              ? { from: wordRange.from, to: wordRange.to, doc: editor.state.doc }
              : null;
          document.addEventListener("keydown", cancel, true);
          document.addEventListener("pointerdown", cancel, true);
          window.addEventListener("blur", cancel);
          editor?.dom.addEventListener("blur", cancel, true);
          const cleanup = () => {
            document.removeEventListener("keydown", cancel, true);
            document.removeEventListener("pointerdown", cancel, true);
            window.removeEventListener("blur", cancel);
            editor?.dom.removeEventListener("blur", cancel, true);
          };
          setSpelling(null);
          const timer = setTimeout(() => {
            cancel();
            setSpelling(null);
            open(point);
          }, 300);
          pending.current = { point, range, cleanup, open, timer, deadline: Date.now() + 300 };
        }
      : undefined,
    leadingGroup:
      enabled && spelling
        ? {
            label: t("spelling.title"),
            items: spelling.info.suggestions.length
              ? spelling.info.suggestions.map((suggestion) => ({
                  label: suggestion,
                  disabled: readOnly || !spelling.range,
                  onSelect: () => {
                    if (!readOnly && view.current)
                      replaceSpelling(view.current, spelling.range, spelling.info.word, suggestion);
                  },
                }))
              : [{ label: t("spelling.none"), disabled: true, onSelect: () => {} }],
          }
        : undefined,
  };
}

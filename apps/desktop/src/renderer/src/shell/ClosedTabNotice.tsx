import { Button, Info } from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NoticeCapsule } from "./NoticeCapsule.tsx";

export function ClosedTabNotice({
  message,
  onUndo,
  onRemove,
  stackPaused = false,
  stacked = false,
}: {
  message: string;
  onUndo: () => void;
  onRemove: () => void;
  stackPaused?: boolean;
  stacked?: boolean;
}) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  const pointer = useRef(false);
  const focus = useRef(false);
  const remaining = useRef(5000);
  const action = useRef<(() => void) | null>(null);
  const remove = useRef(onRemove);
  remove.current = onRemove;
  useEffect(() => {
    if (paused || stackPaused) return;
    const started = Date.now();
    const timer = setTimeout(() => setClosing(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, stackPaused]);
  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => (action.current ?? remove.current)(),
      reduced ? 0 : stacked ? 160 : 200,
    );
    return () => clearTimeout(timer);
  }, [closing, stacked]);
  return (
    <li
      role="status"
      data-closed-notice
      data-closing={closing}
      data-stack-motion={stacked}
      className="ld-closed-notice min-w-0 list-none transition-opacity duration-200 ease-out motion-reduce:transition-none"
      style={{ opacity: closing ? 0 : 1 }}
      onPointerEnter={() => {
        pointer.current = true;
        setPaused(true);
      }}
      onPointerLeave={() => {
        pointer.current = false;
        setPaused(focus.current);
      }}
      onFocusCapture={() => {
        focus.current = true;
        setPaused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focus.current = false;
          setPaused(pointer.current);
        }
      }}
    >
      <NoticeCapsule text={message} icon={<Info aria-hidden size={15} className="mr-1 shrink-0" />}>
        <Button
          variant="primary"
          className="ld-no-drag h-6 shrink-0 border-0 px-2 text-xs"
          onClick={() => {
            if (stacked) {
              action.current = onUndo;
              setClosing(true);
            } else onUndo();
          }}
        >
          {t("shell.undoCloseTab")}
        </Button>
      </NoticeCapsule>
    </li>
  );
}

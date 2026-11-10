import { useRef, useState } from "react";
import type { OperationFeedback } from "./types.ts";
import { useDialogReturnFocus } from "./use-dialog-return-focus.ts";

export function useCashDialog(busy: boolean, operation: OperationFeedback) {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const origin = useRef('[data-cash-dialog-trigger="nav"]');
  const returnFocus = useDialogReturnFocus(root, busy, operation);
  return {
    root,
    open,
    change: (next: boolean) => {
      if (!next && operation.writing) return;
      if (next) {
        const trigger = document.activeElement?.closest("[data-cash-dialog-trigger]");
        origin.current =
          trigger?.getAttribute("data-cash-dialog-trigger") === "panel"
            ? '[data-cash-dialog-trigger="panel"]'
            : '[data-cash-dialog-trigger="nav"]';
      }
      setOpen(next);
    },
    close: () => setOpen(false),
    restoreFocus: (event: Event) => {
      returnFocus(event, origin.current);
      const target = root.current?.querySelector<HTMLElement>(
        busy ? ':scope > div > [role="alert"] button:not([disabled])' : origin.current,
      );
      (target && !target.hasAttribute("disabled") ? target : root.current)?.focus({
        preventScroll: true,
      });
    },
  };
}

import { type RefObject, useEffect, useState } from "react";
import type { OperationFeedback } from "./types.ts";

export function useDialogReturnFocus(
  root: RefObject<HTMLElement | null>,
  busy: boolean,
  operation: OperationFeedback,
) {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (!target || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    const app = root.current?.closest(".ventas-app");
    const element = root.current?.querySelector<HTMLElement>(target);
    if (busy) {
      if (operation.issue && !operation.writing && !operation.loading)
        app
          ?.querySelector<HTMLButtonElement>(':scope > div > [role="alert"] button:not([disabled])')
          ?.focus();
      else if (element?.matches("h1, h2, h3")) element.focus({ preventScroll: true });
      return;
    }
    if (!element || element.hasAttribute("disabled")) return;
    element.focus({ preventScroll: true });
    setTarget(null);
  }, [root, target, busy, operation.issue, operation.writing, operation.loading]);
  return (event: Event, selector: string) => {
    event.preventDefault();
    setTarget(selector);
  };
}

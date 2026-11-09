import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { OperationFeedback } from "./types.ts";

export function useSaleClientFocus(
  root: RefObject<HTMLElement | null>,
  busy: boolean,
  dialogOpen: boolean,
  newClient: string | null,
  selected: string | null,
  operation: OperationFeedback,
) {
  const [requested, setRequested] = useState(false);
  const expected = useRef<string | null>(null),
    recoveryFocused = useRef(false);
  const begin = useCallback(() => {
    expected.current = null;
    recoveryFocused.current = false;
    setRequested(false);
  }, []);
  const created = useCallback((id: string) => {
    expected.current = id;
  }, []);
  const request = useCallback((event: Event) => {
    event.preventDefault();
    recoveryFocused.current = false;
    setRequested(true);
  }, []);
  useEffect(() => {
    if (!requested || dialogOpen) return;
    const input = root.current?.querySelector<HTMLInputElement>("[data-sale-client-search]");
    if (
      busy ||
      newClient !== null ||
      (expected.current !== null && selected !== expected.current) ||
      !input ||
      input.disabled
    ) {
      if (operation.issue && !operation.writing && !operation.loading && !recoveryFocused.current) {
        const retry = root.current
          ?.closest(".ventas-app")
          ?.querySelector<HTMLButtonElement>(
            ':scope > div > [role="alert"] button:not([disabled])',
          );
        if (retry && !retry.closest('[hidden], [aria-hidden="true"]')) {
          retry.focus();
          recoveryFocused.current = document.activeElement === retry;
        }
      }
      return;
    }
    input.dataset.saleRestoreFocus = "true";
    input.focus({ preventScroll: true });
    delete input.dataset.saleRestoreFocus;
    expected.current = null;
    setRequested(false);
  }, [
    requested,
    dialogOpen,
    busy,
    newClient,
    selected,
    root,
    operation.issue,
    operation.writing,
    operation.loading,
  ]);
  return { begin, created, request };
}

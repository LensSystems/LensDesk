import { useEffect, useRef, useState } from "react";
import type { Action } from "../shared/contracts.ts";
import type { OperationFeedback, RunAction } from "./types.ts";

export function useDialogOperation(
  run: RunAction,
  operation: OperationFeedback,
  close: () => void,
  onSaved?: (id: string) => void,
) {
  const [owner] = useState(() => crypto.randomUUID());
  const changes = useRef(0);
  const submitted = useRef<number | null>(null);
  const handled = useRef(false);
  const [savedDraft, setSavedDraft] = useState(false);
  useEffect(() => {
    if (operation.confirmedOwner !== owner || handled.current || submitted.current === null) return;
    handled.current = true;
    if (operation.confirmedId) onSaved?.(operation.confirmedId);
    if (changes.current === submitted.current) close();
    else setSavedDraft(true);
  }, [operation.confirmedOwner, operation.confirmedId, owner, close, onSaved]);
  return {
    savedDraft,
    changed: () => {
      changes.current += 1;
    },
    submit: (action: Action) => {
      if (savedDraft) return;
      submitted.current = changes.current;
      void run(action, owner);
    },
  };
}

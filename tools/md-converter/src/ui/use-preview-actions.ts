import type { createToolClient } from "@lensdesk/sdk";
import { changeCopyState } from "@lensdesk/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { QueueItem } from "./use-queue.ts";

type Failure = "copyFailed" | "saveFailed" | "saveAllFailed";
type Client = ReturnType<typeof createToolClient>;

export function usePreviewActions(client: Client, item: QueueItem | null) {
  const identity = useMemo(() => Symbol(item?.id), [item?.id]);
  const currentIdentity = useRef<symbol | null>(identity);
  currentIdentity.current = identity;
  const copyButton = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyOperation = useRef(0);
  const lastAction = useRef(0);
  const [confirmation, setConfirmation] = useState<symbol | null>(null);
  const [failure, setFailure] = useState<{ identity: symbol; kind: Failure } | null>(null);
  useEffect(() => {
    currentIdentity.current = identity;
    clearTimeout(copyTimer.current);
    if (copyButton.current) changeCopyState(copyButton.current, () => {});
    return () => {
      if (currentIdentity.current === identity) currentIdentity.current = null;
      clearTimeout(copyTimer.current);
    };
  }, [identity]);
  const updateCopied = (value: boolean) => {
    const update = () => setConfirmation(value ? identity : null);
    if (copyButton.current) changeCopyState(copyButton.current, () => flushSync(update));
    else update();
  };
  const copied = confirmation === identity;
  const copy = async () => {
    if (item?.status !== "done") return;
    const operation = ++copyOperation.current;
    const action = ++lastAction.current;
    setFailure(null);
    const current = () =>
      currentIdentity.current === identity && copyOperation.current === operation;
    try {
      await client.ui.copyText(item.markdown);
      if (!current()) return;
      clearTimeout(copyTimer.current);
      updateCopied(true);
      copyTimer.current = setTimeout(() => {
        if (currentIdentity.current === identity) updateCopied(false);
      }, 2000);
    } catch {
      if (!current()) return;
      clearTimeout(copyTimer.current);
      if (copied) updateCopied(false);
      if (lastAction.current === action) setFailure({ identity, kind: "copyFailed" });
    }
  };
  const attempt = async (
    kind: Exclude<Failure, "copyFailed">,
    operation: () => Promise<unknown>,
  ) => {
    const action = ++lastAction.current;
    setFailure(null);
    try {
      await operation();
    } catch {
      if (currentIdentity.current === identity && lastAction.current === action)
        setFailure({ identity, kind });
    }
  };
  return {
    copyButton,
    copied,
    copy,
    attempt,
    notice: failure?.identity === identity ? failure.kind : null,
  };
}

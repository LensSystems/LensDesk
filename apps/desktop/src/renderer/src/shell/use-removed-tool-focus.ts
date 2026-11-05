import { useLayoutEffect, useState } from "react";
import type { ToolSummary } from "../../../shared/host-channels.ts";

// Wait for both the successful reply and the committed tools list, in either order.
export function useRemovedToolFocus(tools: ToolSummary[]) {
  const [removed, setRemoved] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!removed || tools.some((tool) => tool.id === removed)) return;
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
    setRemoved(null);
  }, [tools, removed]);
  return setRemoved;
}

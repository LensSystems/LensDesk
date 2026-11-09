import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "../shared/contracts.ts";
import { defaultBank } from "../shared/values.ts";
import { emptyWorkspace } from "./ticket-workspace.ts";

export function useTicketWorkspace(data: Snapshot | null, restoredId: string | null) {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !restoredId || restored.current === restoredId) return;
    restored.current = restoredId;
    setWorkspace({
      ...emptyWorkspace,
      initialized: true,
      clientId: data.clients[0]?.id ?? null,
      bankId: defaultBank(data.settings),
    });
  }, [data, restoredId]);
  return [workspace, setWorkspace] as const;
}

import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "../shared/contracts.ts";
import { saleDetailSchema } from "../shared/history-contracts.ts";
import { parseQueryResult } from "../shared/query-result.ts";
import { emptyWorkspace } from "./ticket-workspace.ts";
import type { ReadQuery } from "./types.ts";

export function useTicketWorkspace(
  { data, restoredId }: { data: Snapshot | null; restoredId: string | null },
  read: ReadQuery,
) {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const selected = workspace.selected;
  const restored = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !restoredId || restored.current === restoredId) return;
    restored.current = restoredId;
    // A restored snapshot contains all clients and banks, but no complete sale history.
    setWorkspace((state) => ({
      ...state,
      initialized: true,
      autoSelect: false,
      clientId: data.clients.some((client) => client.id === state.clientId) ? state.clientId : null,
      bankId: data.settings.banks.some((bank) => bank.id === state.bankId) ? state.bankId : null,
      payment: null,
    }));
  }, [data, restoredId]);
  useEffect(() => {
    if (!data || !restoredId || !selected) return;
    let alive = true;
    void read("saleDetail", {
      saleId: selected,
      paymentOffset: 0,
      returnOffset: 0,
      revision: data.revision,
    })
      .then((raw) => {
        const result = parseQueryResult(saleDetailSchema, raw);
        if (!alive || result.kind !== "rejected" || result.issue.code !== "E_NOT_FOUND") return;
        setWorkspace((state) =>
          state.selected === selected ? { ...state, selected: null, review: false } : state,
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [data, restoredId, selected, read]);
  return [workspace, setWorkspace] as const;
}

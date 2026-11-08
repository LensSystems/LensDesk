import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Action,
  mutationResultSchema,
  type Snapshot,
  snapshotResultSchema,
} from "../shared/contracts.ts";
import type { Client, RunAction } from "./types.ts";

export function useSales(client: Client) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [confirmedOwner, setConfirmedOwner] = useState<string | null>(null);
  const running = useRef(false);
  const reconciliation = useRef(false);
  const [unresolved, setUnresolved] = useState(false);
  const pending = useRef<{
    fingerprint: string;
    key: string;
    revision: number;
    action: Action;
    owner?: string;
  } | null>(null);
  const refresh = useCallback(async () => {
    const result = snapshotResultSchema.parse(await client.backend.invoke("snapshot"));
    setData(result.value);
    reconciliation.current = false;
    setUnresolved(false);
  }, [client]);
  const load = useCallback(() => {
    const request = ++loadingRequest.current;
    setLoading(true);
    setIssue(null);
    void client.backend
      .invoke("snapshot")
      .then((raw) => {
        const result = snapshotResultSchema.parse(raw);
        if (request === loadingRequest.current) {
          setData(result.value);
          reconciliation.current = false;
          setUnresolved(false);
        }
      })
      .catch(() => {
        if (request === loadingRequest.current)
          setIssue(reconciliation.current ? "E_RELOAD_REQUIRED" : "E_INTERNAL");
      })
      .finally(() => {
        if (request === loadingRequest.current) setLoading(false);
      });
  }, [client]);
  useEffect(() => {
    load();
    return () => {
      loadingRequest.current += 1;
    };
  }, [load]);
  const run: RunAction = async (action, owner) => {
    if (!data || running.current || reconciliation.current || loading) return false;
    const fingerprint = JSON.stringify(action);
    if (pending.current && pending.current.fingerprint !== fingerprint) {
      setIssue("E_OPERATION_PENDING");
      return false;
    }
    running.current = true;
    setBusy(true);
    setIssue(null);
    const request =
      pending.current?.fingerprint === fingerprint
        ? pending.current
        : { fingerprint, key: crypto.randomUUID(), revision: data.revision, action, owner };
    pending.current = request;
    let confirmed = false;
    try {
      const result = mutationResultSchema.parse(
        await client.backend.invoke("execute", {
          key: request.key,
          revision: request.revision,
          action,
        }),
      );
      pending.current = null;
      reconciliation.current = true;
      setUnresolved(true);
      if (result.kind === "rejected") {
        setIssue(result.issue.code);
        await refresh();
        return false;
      }
      confirmed = true;
      setConfirmedId(result.value.id);
      setConfirmedOwner(request.owner ?? null);
      await refresh();
      return true;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error ? String(error.code) : "E_INTERNAL";
      if (code === "E_INVALID_PARAMS" || code === "E_CANCELLED") pending.current = null;
      setUnresolved(reconciliation.current);
      setIssue(
        confirmed
          ? "E_REFRESH_REQUIRED"
          : reconciliation.current
            ? "E_RELOAD_REQUIRED"
            : pending.current
              ? "E_OPERATION_PENDING"
              : code,
      );
      return confirmed;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const retry = () => {
    if (pending.current) void run(pending.current.action, pending.current.owner);
    else load();
  };
  return {
    pendingConfirmation: Boolean(pending.current),
    confirmedOwner,
    confirmedId,
    writing: busy,
    data,
    busy: busy || unresolved || Boolean(pending.current) || (loading && Boolean(data)),
    loading,
    issue,
    run,
    refresh,
    retry,
  };
}

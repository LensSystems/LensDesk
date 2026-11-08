import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Action,
  mutationResultSchema,
  type Snapshot,
  snapshotResultSchema,
} from "../shared/contracts.ts";
import type { Client, RestoreTarget, RunAction, RunRestore } from "./types.ts";

export function useSales(client: Client) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [invalidRestoreId, setInvalidRestoreId] = useState<string | null>(null);
  const restoreConfirmed = useRef<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [confirmedOwner, setConfirmedOwner] = useState<string | null>(null);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const reconciliation = useRef(false);
  const [unresolved, setUnresolved] = useState(false);
  const pending = useRef<{
    fingerprint: string;
    key: string;
    revision: number;
    action: Action | RestoreTarget;
    method: "execute" | "confirmRestore";
    owner?: string;
  } | null>(null);
  const refresh = useCallback(async () => {
    const result = snapshotResultSchema.parse(await client.backend.invoke("snapshot"));
    setData(result.value);
    if (restoreConfirmed.current) {
      setRestoredId(restoreConfirmed.current);
      restoreConfirmed.current = null;
    }
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
          if (restoreConfirmed.current) {
            setRestoredId(restoreConfirmed.current);
            restoreConfirmed.current = null;
          }
          reconciliation.current = false;
          setUnresolved(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (request === loadingRequest.current) {
          setIssue(reconciliation.current ? "E_RELOAD_REQUIRED" : "E_INTERNAL");
          setLoading(false);
        }
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
  const mutate = async (
    action: Action | RestoreTarget,
    owner: string | undefined,
    method: "execute" | "confirmRestore",
  ) => {
    if (!data || running.current || reconciliation.current || loading) return false;
    const fingerprint = JSON.stringify({ method, action });
    if (pending.current && pending.current.fingerprint !== fingerprint) {
      setIssue("E_OPERATION_PENDING");
      return false;
    }
    running.current = true;
    if (method === "confirmRestore") {
      controller.current = new AbortController();
      setProgress(0);
    }
    setBusy(true);
    setIssue(null);
    const request =
      pending.current?.fingerprint === fingerprint
        ? pending.current
        : {
            fingerprint,
            key: crypto.randomUUID(),
            revision:
              method === "confirmRestore" && "revision" in action ? action.revision : data.revision,
            action,
            owner,
            method,
          };
    pending.current = request;
    let confirmed = false;
    try {
      const result = mutationResultSchema.parse(
        await (request.method === "confirmRestore"
          ? client.backend.invoke(
              request.method,
              { ...request.action, key: request.key },
              {
                signal: controller.current?.signal,
                onProgress: (event) => setProgress(event.fraction),
              },
            )
          : client.backend.invoke("execute", {
              key: request.key,
              revision: request.revision,
              action: request.action,
            })),
      );
      pending.current = null;
      reconciliation.current = true;
      setUnresolved(true);
      if (result.kind === "rejected") {
        if (
          method === "confirmRestore" &&
          "id" in request.action &&
          ["E_BACKUP_CHANGED", "E_BACKUP_EXPIRED", "E_BACKUP_SOURCE", "E_REVISION"].includes(
            result.issue.code,
          )
        )
          setInvalidRestoreId(request.action.id);
        setIssue(result.issue.code);
        await refresh();
        return false;
      }
      confirmed = true;
      if (method === "confirmRestore") restoreConfirmed.current = result.value.id;
      setConfirmedId(result.value.id);
      setConfirmedOwner(request.owner ?? null);
      await refresh();
      return true;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error ? String(error.code) : "E_INTERNAL";
      if (code === "E_INVALID_PARAMS" || (code === "E_CANCELLED" && method === "execute"))
        pending.current = null;
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
      controller.current = null;
      setProgress(null);
      running.current = false;
      setBusy(false);
    }
  };
  const run: RunAction = (action, owner) => mutate(action, owner, "execute");
  const restore: RunRestore = (target, owner) =>
    mutate(
      { id: target.id, hash: target.hash, revision: target.revision },
      owner,
      "confirmRestore",
    );
  const retry = () => {
    if (pending.current)
      void mutate(pending.current.action, pending.current.owner, pending.current.method);
    else load();
  };
  return {
    pendingConfirmation: Boolean(pending.current),
    confirmedOwner,
    confirmedId,
    restoredId,
    invalidRestoreId,
    writing: busy,
    progress,
    cancel: () => controller.current?.abort(),
    data,
    busy: busy || unresolved || Boolean(pending.current) || (loading && Boolean(data)),
    loading,
    issue,
    run,
    restore,
    refresh,
    retry,
  };
}

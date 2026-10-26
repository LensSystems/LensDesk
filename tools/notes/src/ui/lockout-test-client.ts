import { vi } from "vitest";
import type { Note } from "./NoteList.tsx";
import type { VaultStatus } from "./use-vault.ts";
import { normalLockout, type VaultAttempt } from "./vault-lockout.ts";
export function lockoutClient(privateCount = 1, orphaned = false, privateNote = true) {
  let row: Note | null = {
    id: "one",
    title: "Visible",
    body_md: "",
    private: privateNote,
    orphaned,
    pinned: false,
    created_at: "now",
    updated_at: "now",
    deleted_at: orphaned ? "now" : null,
  };
  const status: VaultStatus = {
    configured: true,
    unlocked: false,
    questions: ["Ciudad", "Animal"],
    privateCount,
    lockout: structuredClone(normalLockout),
  };
  let failure = "";
  let failureStage: VaultAttempt["stage"] = "limit";
  const invoke = vi.fn(async (method: string, args: Record<string, unknown>) => {
    if (method === "vaultStatus") return structuredClone(status);
    if (method === "list")
      return row && (args.view === "trash") === Boolean(row.deleted_at) ? [{ ...row }] : [];
    if (method === "vaultUnlock" || method === "vaultReset") {
      if (failure) {
        status.lockout[method === "vaultUnlock" ? "password" : "recovery"] = {
          stage: failureStage,
          failures: failureStage === "exhausted" ? 11 : 10,
          retryAt: failureStage === "exhausted" ? null : Date.now() + 1_800_000,
        };
        throw { code: "E_PERMISSION_DENIED", message: failure };
      }
      status.unlocked = true;
    } else if (method === "vaultWipe") {
      status.configured = false;
      status.unlocked = false;
      status.privateCount = 0;
      status.lockout = structuredClone(normalLockout);
      if (row) row = { ...row, orphaned: true, deleted_at: "now" };
    } else if (method === "deleteForever") row = null;
    else if (method === "vaultSetup") {
      status.configured = true;
      status.unlocked = true;
    } else if (method === "vaultLock") status.unlocked = false;
    else throw new Error(method);
    return {};
  });
  const client = {
    backend: { invoke },
    storage: { get: async () => true },
    app: {
      getContext: async () => ({ locale: "es", theme: "dark" }),
      onContextChange: () => () => {},
      onVisibilityChange: () => () => {},
    },
    ui: { copyText: vi.fn() },
  };
  return {
    client,
    invoke,
    status,
    fail: (message: string, stage: typeof failureStage) => {
      failure = message;
      failureStage = stage;
    },
  };
}

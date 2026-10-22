import { vi } from "vitest";
import type { Note } from "./NoteList.tsx";
export function vaultTestClient(privateNote = true, configured = true) {
  let row: Note = {
    id: "one",
    title: "Visible",
    body_md: "Original",
    private: privateNote,
    pinned: false,
    created_at: "now",
    updated_at: "now",
    deleted_at: null,
  };
  let unlocked = true;
  let failure: string | null = null;
  let statusGate: Promise<void> | undefined;
  let updateGate: Promise<void> | undefined;
  let setupGate: Promise<void> | undefined;
  const listeners = new Set<(visible: boolean) => void>();
  const invoke = vi.fn(async (method: string, args: Record<string, unknown>) => {
    if (method === "list") return [{ ...row, body_md: row.private ? "" : row.body_md }];
    if (method === "vaultStatus") {
      await statusGate;
      return { configured, unlocked, questions: ["Ciudad", "Animal"] };
    }
    if (method === "vaultSetup") {
      await setupGate;
      configured = true;
      unlocked = true;
      return {};
    }
    if (method === "vaultLock") {
      unlocked = false;
      return {};
    }
    if (method === "vaultUnlock") {
      unlocked = true;
      return {};
    }
    if (method === "get") {
      if (!unlocked) throw { code: "E_PERMISSION_DENIED" };
      return { ...row };
    }
    if (method === "update") {
      await updateGate;
      if (failure || (row.private && !unlocked)) throw { code: failure ?? "E_PERMISSION_DENIED" };
      row = { ...row, body_md: args.body_md as string };
      return { ...row };
    }
    if (method === "setPrivate") {
      row = { ...row, private: args.private as boolean };
      return { ...row };
    }
    throw new Error(method);
  });
  const client = {
    backend: { invoke },
    storage: { get: async () => true },
    app: {
      getContext: async () => ({ locale: "es", theme: "dark" }),
      onContextChange: () => () => {},
      onVisibilityChange: (listener: (visible: boolean) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    ui: { copyText: vi.fn() },
    files: { pickSave: vi.fn() },
  };
  return {
    client,
    invoke,
    row: () => row,
    visibility: (visible: boolean) => {
      for (const listener of listeners) listener(visible);
    },
    fail: (code: string | null) => {
      failure = code;
    },
    expire: () => {
      unlocked = false;
    },
    delayStatus: () => {
      let release = () => {};
      statusGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    delayUpdate: () => {
      let release = () => {};
      updateGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    delaySetup: () => {
      let release = () => {};
      setupGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
  };
}

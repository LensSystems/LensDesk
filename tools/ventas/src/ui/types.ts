import type { createToolClient } from "@lensdesk/sdk";
import type { Action, Snapshot } from "../shared/contracts.ts";

export type Client = ReturnType<typeof createToolClient>;
export type RestoreTarget = Pick<
  import("../shared/backup-contracts.ts").PreparedBackup,
  "id" | "hash" | "revision"
>;
export type RunRestore = (target: RestoreTarget, owner?: string) => Promise<boolean>;
export type RunAction = (action: Action, owner?: string) => Promise<boolean>;
export type OperationFeedback = {
  issue: string | null;
  writing: boolean;
  loading: boolean;
  pendingConfirmation: boolean;
  confirmedOwner: string | null;
  confirmedId: string | null;
  retry: () => void;
  progress?: number | null;
  invalidRestoreId?: string | null;
  cancel?: () => void;
};
export type ReadQuery = (method: string, params?: unknown) => Promise<unknown>;
export type ScreenProps = {
  read: ReadQuery;
  data: Snapshot;
  run: RunAction;
  busy: boolean;
  operation: OperationFeedback;
};
export const screens = [
  "sale",
  "accounts",
  "tickets",
  "inventory",
  "expenses",
  "summary",
  "settings",
] as const;
export type Screen = (typeof screens)[number];

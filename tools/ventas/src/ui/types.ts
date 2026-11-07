import type { createToolClient } from "@lensdesk/sdk";
import type { Action, Snapshot } from "../shared/contracts.ts";

export type Client = ReturnType<typeof createToolClient>;
export type RunAction = (action: Action, owner?: string) => Promise<boolean>;
export type OperationFeedback = {
  issue: string | null;
  writing: boolean;
  loading: boolean;
  pendingConfirmation: boolean;
  confirmedOwner: string | null;
  retry: () => void;
};
export type ScreenProps = {
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

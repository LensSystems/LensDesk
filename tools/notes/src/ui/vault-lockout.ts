export type VaultAttempt = {
  stage: "normal" | "wait" | "limit" | "last" | "exhausted";
  failures: number;
  retryAt: number | null;
};
export type VaultLockout = { password: VaultAttempt; recovery: VaultAttempt };
export const normalLockout: VaultLockout = {
  password: { stage: "normal", failures: 0, retryAt: null },
  recovery: { stage: "normal", failures: 0, retryAt: null },
};
export function visibleAttempt(lockout: VaultLockout, purpose: keyof VaultLockout) {
  if (lockout.password.stage === "exhausted") return lockout.password;
  if (lockout.recovery.stage === "exhausted") return lockout.recovery;
  return lockout[purpose];
}
export function secondsLeft(attempt: VaultAttempt) {
  return Math.max(0, Math.ceil(((attempt.retryAt ?? 0) - Date.now()) / 1000));
}

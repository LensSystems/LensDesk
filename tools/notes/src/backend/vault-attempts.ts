import { LensError } from "@lensdesk/sdk/errors";

export type Purpose = "password" | "recovery";
export type Attempt = { failures: number; retryAt: number };
export type Stage = {
  stage: "normal" | "wait" | "limit" | "last" | "exhausted";
  failures: number;
  retryAt: number | null;
};
export type AttemptStore = {
  read(purpose: Purpose): Attempt;
  save(purpose: Purpose, value: Attempt): void;
};
export function createAttempts(now: () => number, store?: AttemptStore) {
  const memory = { password: { failures: 0, retryAt: 0 }, recovery: { failures: 0, retryAt: 0 } };
  const read = (purpose: Purpose) => store?.read(purpose) ?? memory[purpose];
  function save(purpose: Purpose, value: Attempt) {
    if (store) store.save(purpose, value);
    else memory[purpose] = value;
  }
  function stage(purpose: Purpose): Stage {
    const value = read(purpose);
    const waiting = value.retryAt > now();
    return {
      failures: value.failures,
      retryAt: waiting ? value.retryAt : null,
      stage:
        value.failures >= 11
          ? "exhausted"
          : value.failures >= 10
            ? waiting
              ? "limit"
              : "last"
            : waiting
              ? "wait"
              : "normal",
    };
  }
  function denied(message: string): never {
    throw new LensError("E_PERMISSION_DENIED", message);
  }
  function check(purpose: Purpose) {
    if (read("password").failures >= 11 || read("recovery").failures >= 11)
      denied("No attempts left");
    const value = stage(purpose);
    if (value.retryAt !== null)
      denied(
        `${value.stage === "limit" ? "Attempt limit reached" : "Too many attempts"}. Wait ${Math.ceil((value.retryAt - now()) / 1000)} seconds`,
      );
  }
  return {
    status: () => ({ password: stage("password"), recovery: stage("recovery") }),
    check,
    fail(purpose: Purpose): never {
      const failures = read(purpose).failures + 1;
      const delay =
        failures >= 11
          ? 0
          : failures === 10
            ? 1_800_000
            : failures >= 5
              ? Math.min(300_000, 30_000 * 2 ** (failures - 5))
              : 0;
      save(purpose, { failures, retryAt: delay ? now() + delay : 0 });
      check(purpose);
      return denied(`Invalid credentials. ${5 - failures} attempts left`);
    },
    reset() {
      for (const purpose of ["password", "recovery"] as const)
        save(purpose, { failures: 0, retryAt: 0 });
    },
  };
}

import { scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { openNotesDatabase } from "./db/driver.ts";
import { createNotesRepository } from "./notes-repo.ts";
import type { Purpose } from "./vault-attempts.ts";

vi.mock("node:crypto", async (original) => {
  const actual = await original<typeof import("node:crypto")>();
  return { ...actual, scryptSync: vi.fn(actual.scryptSync) };
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const work of cleanup.splice(0).reverse()) work();
});
const config = { password: "Abc123!", questions: ["A", "B"], answers: ["aa", "bb"] };
function setup() {
  let time = 1_700_000_000_000;
  const dir = mkdtempSync(join(tmpdir(), "notes-lockout-"));
  let db = openNotesDatabase(dir);
  const now = () => new Date(time);
  let repo = createNotesRepository(db, now);
  cleanup.push(() => {
    repo.vaultLock({});
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  repo.vaultSetup(config);
  return {
    get repo() {
      return repo;
    },
    get db() {
      return db;
    },
    get time() {
      return time;
    },
    advance(ms: number) {
      time += ms;
    },
    reopen() {
      repo.vaultLock({});
      db.close();
      db = openNotesDatabase(dir);
      repo = createNotesRepository(db, now);
    },
    attempt(purpose: Purpose, good = false) {
      return purpose === "password"
        ? repo.vaultUnlock({ password: good ? config.password : "wrong" })
        : repo.vaultReset({
            password: config.password,
            answers: good ? config.answers : ["no", "no"],
          });
    },
  };
}
function denied(work: () => unknown, message: string) {
  expect(work).toThrow(expect.objectContaining({ code: "E_PERMISSION_DENIED", message }));
}

it.each(["password", "recovery"] as const)(
  "progresa 1→11 en %s y persiste cada etapa",
  (purpose) => {
    const f = setup();
    const other: Purpose = purpose === "password" ? "recovery" : "password";
    const normal = { stage: "normal", failures: 0, retryAt: null };
    expect(f.repo.vaultStatus({}).lockout).toEqual({ password: normal, recovery: normal });
    for (let failures = 1; failures <= 11; failures++) {
      const seconds =
        failures === 10
          ? 1800
          : failures >= 5 && failures < 10
            ? ([30, 60, 120, 240, 300][failures - 5] ?? 0)
            : 0;
      const message =
        failures === 11
          ? "No attempts left"
          : seconds
            ? `${failures === 10 ? "Attempt limit reached" : "Too many attempts"}. Wait ${seconds} seconds`
            : `Invalid credentials. ${5 - failures} attempts left`;
      denied(() => f.attempt(purpose), message);
      const expected = {
        failures,
        stage:
          failures === 11 ? "exhausted" : failures === 10 ? "limit" : seconds ? "wait" : "normal",
        retryAt: seconds ? f.time + seconds * 1000 : null,
      };
      expect(f.repo.vaultStatus({}).lockout[purpose]).toEqual(expected);
      expect(f.repo.vaultStatus({}).lockout[other]).toEqual(normal);
      f.reopen();
      expect(f.repo.vaultStatus({}).lockout[purpose]).toEqual(expected);
      if (seconds) {
        const calls = vi.mocked(scryptSync).mock.calls.length;
        denied(() => f.attempt(purpose, true), message);
        expect(vi.mocked(scryptSync).mock.calls.length).toBe(calls);
        f.advance(seconds * 1000 - 1);
        denied(
          () => f.attempt(purpose),
          `${failures === 10 ? "Attempt limit reached" : "Too many attempts"}. Wait 1 seconds`,
        );
        f.advance(1);
        expect(f.repo.vaultStatus({}).lockout[purpose]).toEqual({
          stage: failures === 10 ? "last" : "normal",
          failures,
          retryAt: null,
        });
      }
    }
    const calls = vi.mocked(scryptSync).mock.calls.length;
    for (const p of [purpose, other]) {
      denied(() => f.attempt(p, true), "No attempts left");
      denied(() => f.attempt(p), "No attempts left");
    }
    expect(vi.mocked(scryptSync).mock.calls.length).toBe(calls);
  },
);

it.each(["password", "recovery"] as const)(
  "el último intento correcto de %s limpia y guarda ambos contadores",
  (purpose) => {
    const f = setup();
    const other: Purpose = purpose === "password" ? "recovery" : "password";
    denied(() => f.attempt(other), "Invalid credentials. 4 attempts left");
    for (let i = 1; i <= 10; i++) {
      expect(() => f.attempt(purpose)).toThrow();
      const retryAt = f.repo.vaultStatus({}).lockout[purpose].retryAt;
      if (retryAt) f.advance(retryAt - f.time);
    }
    expect(f.repo.vaultStatus({}).lockout[purpose].stage).toBe("last");
    f.attempt(purpose, true);
    f.reopen();
    expect(f.repo.vaultStatus({}).lockout).toEqual({
      password: { stage: "normal", failures: 0, retryAt: null },
      recovery: { stage: "normal", failures: 0, retryAt: null },
    });
  },
);

it.each(["password", "recovery"] as const)(
  "la espera de %s deja disponible el otro propósito",
  (purpose) => {
    const f = setup();
    for (let i = 0; i < 5; i++) expect(() => f.attempt(purpose)).toThrow();
    f.attempt(purpose === "password" ? "recovery" : "password", true);
    f.reopen();
    expect(
      Object.values(f.repo.vaultStatus({}).lockout).every((value) => value.failures === 0),
    ).toBe(true);
  },
);

it.each(["password", "recovery"] as const)(
  "agotado %s cierra ambos propósitos sin derivar claves",
  (purpose) => {
    const f = setup();
    f.db.run("INSERT OR REPLACE INTO vault_attempts VALUES (?, 11, 0)", purpose);
    const calls = vi.mocked(scryptSync).mock.calls.length;
    for (const p of ["password", "recovery"] as const) {
      denied(() => f.attempt(p, true), "No attempts left");
      denied(() => f.attempt(p), "No attempts left");
    }
    expect(vi.mocked(scryptSync).mock.calls.length).toBe(calls);
    expect(f.repo.vaultStatus({}).lockout[purpose]).toEqual({
      stage: "exhausted",
      failures: 11,
      retryAt: null,
    });
  },
);

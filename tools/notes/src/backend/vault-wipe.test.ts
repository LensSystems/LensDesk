import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { openNotesDatabase } from "./db/driver.ts";
import { createNotesRepository } from "./notes-repo.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const work of cleanup.splice(0).reverse()) work();
});
const config = { password: "Abc123!", questions: ["A", "B"], answers: ["aa", "bb"] };
function setup(configured = true) {
  let time = 1_700_000_000_000;
  const dir = mkdtempSync(join(tmpdir(), "notes-wipe-"));
  const db = openNotesDatabase(dir);
  const repo = createNotesRepository(db, () => new Date(time));
  cleanup.push(() => {
    repo.vaultLock({});
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  if (configured) repo.vaultSetup(config);
  return {
    repo,
    db,
    dir,
    advance() {
      time += 1000;
    },
    stage(stage: string, purpose = "password") {
      const failures = { normal: 0, wait: 5, limit: 10, last: 10, exhausted: 11 }[stage] ?? 0;
      db.run(
        "INSERT OR REPLACE INTO vault_attempts VALUES (?, ?, ?)",
        purpose,
        failures,
        stage === "wait" || stage === "limit" ? time + 1_800_000 : 0,
      );
    },
  };
}
const denied = (work: () => unknown, message: string) =>
  expect(work).toThrow(expect.objectContaining({ code: "E_PERMISSION_DENIED", message }));

it.each(["normal", "wait"])("rechaza borrar la bóveda en %s sin cambiar datos", (stage) => {
  const f = setup();
  f.stage(stage);
  const before = f.db.all("SELECT * FROM vault");
  denied(() => f.repo.vaultWipe({}), "Reset not allowed");
  expect(f.db.all("SELECT * FROM vault")).toEqual(before);
});
it("rechaza borrar si no existe bóveda y valida parámetros", () => {
  const f = setup(false);
  f.stage("limit");
  denied(() => f.repo.vaultWipe({}), "Reset not allowed");
  for (const params of [null, [], { extra: true }])
    expect(() => f.repo.vaultWipe(params)).toThrow(
      expect.objectContaining({ code: "E_INVALID_PARAMS" }),
    );
});
it.each(["limit", "last", "exhausted"])(
  "restablece desde %s y conserva huérfanas inaccesibles tras configurar otra bóveda",
  (stage) => {
    const f = setup();
    const ids = [0, 1, 2].map((i) => {
      const { id } = f.repo.create({ title: `Privada ${i}`, body_md: `secreto ${i}` });
      f.repo.setPrivate({ id, private: true });
      f.repo.setPinned({ id, pinned: true });
      return id;
    });
    const [normal, archived, trashed] = ids as [string, string, string];
    f.repo.archive({ id: archived });
    const originalTrash = f.repo.trash({ id: trashed }).deleted_at;
    const publicNote = f.repo.create({ body_md: "pública" });
    expect(f.repo.vaultStatus({}).privateCount).toBe(3);
    const old = JSON.parse(
      f.db.get<{ record: string }>("SELECT record FROM vault")?.record ?? "{}",
    );
    f.stage(stage, "recovery");
    f.advance();
    expect(f.repo.vaultWipe({})).toEqual({ configured: false, orphaned: 3 });
    expect(f.repo.vaultStatus({})).toEqual({
      configured: false,
      unlocked: false,
      questions: [],
      privateCount: 0,
      lockout: {
        password: { stage: "normal", failures: 0, retryAt: null },
        recovery: { stage: "normal", failures: 0, retryAt: null },
      },
    });
    expect(
      f.repo
        .list({ view: "trash" })
        .map((n) => n.id)
        .sort(),
    ).toEqual([...ids].sort());
    expect(f.repo.list({ view: "archived" })).toEqual([]);
    expect(f.repo.get({ id: trashed }).deleted_at).toBe(originalTrash);
    for (const suffix of ["", "-wal"]) {
      const file = join(f.dir, `notes.db${suffix}`);
      if (existsSync(file))
        expect(readFileSync(file).includes(Buffer.from(old.password.salt))).toBe(false);
    }
    for (const unlocked of [false, true]) {
      if (unlocked)
        expect(f.repo.vaultSetup({ ...config, password: "Nueva12" })).toEqual({ unlocked: true });
      for (const id of ids) {
        const note = f.repo.get({ id });
        expect(note).toMatchObject({ private: true, orphaned: true, pinned: false, body_md: "" });
        expect(note.deleted_at).not.toBeNull();
        for (const work of [
          () => f.repo.restore({ id }),
          () => f.repo.update({ id, body_md: "cambio" }),
          () => f.repo.rename({ id, title: "cambio" }),
          () => f.repo.setPrivate({ id, private: false }),
          () => f.repo.setPinned({ id, pinned: true }),
          () => f.repo.archive({ id }),
          () => f.repo.unarchive({ id }),
        ])
          denied(work, "Note cannot be opened");
        f.advance();
        expect(f.repo.trash({ id })).toEqual(note);
      }
    }
    expect(f.repo.get({ id: publicNote.id }).body_md).toBe("pública");
    expect(f.repo.vaultStatus({}).privateCount).toBe(0);
    expect(f.repo.deleteForever({ id: normal })).toEqual({ deleted: true });
    expect(() => f.repo.get({ id: normal })).toThrow(
      expect.objectContaining({ code: "E_NOT_FOUND" }),
    );
    f.repo.emptyTrash({});
    expect(f.repo.list({ view: "trash" })).toEqual([]);
  },
);
it("borra definitivamente una nota normal solo en papelera y valida id", () => {
  const f = setup(false);
  const { id } = f.repo.create({ body_md: "texto" });
  denied(() => f.repo.deleteForever({ id }), "Note is not in the trash");
  for (const params of [{}, { id: 1 }, { id, extra: true }])
    expect(() => f.repo.deleteForever(params)).toThrow(
      expect.objectContaining({ code: "E_INVALID_PARAMS" }),
    );
  f.repo.trash({ id });
  expect(f.repo.deleteForever({ id })).toEqual({ deleted: true });
  expect(() => f.repo.get({ id })).toThrow(expect.objectContaining({ code: "E_NOT_FOUND" }));
});
it("revierte todo si falla marcar las notas como huérfanas", () => {
  const f = setup();
  const { id } = f.repo.create({ body_md: "secreto" });
  f.repo.setPrivate({ id, private: true });
  f.stage("limit");
  const vault = f.db.all("SELECT * FROM vault");
  const attempts = f.db.all("SELECT * FROM vault_attempts");
  f.db.exec(
    "CREATE TRIGGER fail_wipe BEFORE UPDATE OF orphaned ON notes BEGIN SELECT RAISE(ABORT, 'full'); END",
  );
  expect(() => f.repo.vaultWipe({})).toThrow("full");
  expect(f.db.all("SELECT * FROM vault")).toEqual(vault);
  expect(f.db.all("SELECT * FROM vault_attempts")).toEqual(attempts);
  expect(f.repo.get({ id })).toMatchObject({ body_md: "secreto", deleted_at: null });
});

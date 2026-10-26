import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { openNotesDatabase } from "./db/driver.ts";
import { createNotesRepository } from "./notes-repo.ts";
import { createVault } from "./vault.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "notes-answers-"));
  dirs.push(dir);
  const db = openNotesDatabase(dir);
  const vault = createVault({ scrypt: { N: 16, r: 1, p: 1, length: 32 } });
  return { db, vault, repo: createNotesRepository(db, undefined, vault) };
}
it.each(["", " ", " a ", "😀", "x".repeat(21)])(
  "rechaza respuestas nuevas fuera de límites: %s",
  (answer) => {
    const { db, repo } = setup();
    for (const answers of [
      [answer, "ok"],
      ["ok", answer],
    ])
      expect(() =>
        repo.vaultSetup({ password: "Abc123!", questions: ["Q1", "Q2"], answers }),
      ).toThrow(expect.objectContaining({ code: "E_INVALID_PARAMS" }));
    db.close();
  },
);
it.each([" ab ", "😀😀", "x".repeat(20), "😀".repeat(20)])(
  "acepta límites contando caracteres tras trim: %s",
  (answer) => {
    const { db, repo } = setup();
    repo.vaultSetup({ password: "Abc123!", questions: ["Q1", "Q2"], answers: [answer, "ok"] });
    expect(repo.vaultReset({ password: "Def456!", answers: [answer, "ok"] })).toEqual({
      unlocked: true,
    });
    db.close();
  },
);
it("recupera respuestas antiguas de uno o más de 20 caracteres sin cambiar el formato guardado", () => {
  const { db, vault, repo } = setup();
  const long = "x".repeat(25);
  vault.setup("Abc123!", ["Q1", "Q2"], ["a", long], (record) => {
    db.run("INSERT INTO vault (id, record) VALUES (1, ?)", JSON.stringify(record));
  });
  repo.vaultLock({});
  expect(() => repo.vaultReset({ password: "Def456!", answers: ["", long] })).toThrow(
    expect.objectContaining({ code: "E_INVALID_PARAMS" }),
  );
  expect(repo.vaultReset({ password: "Def456!", answers: ["a", long] })).toEqual({
    unlocked: true,
  });
  repo.vaultLock({});
  expect(repo.vaultUnlock({ password: "Def456!" })).toEqual({ unlocked: true });
  db.close();
});

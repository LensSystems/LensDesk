import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openNotesDatabase } from "./driver.ts";

it("aplica la migración 005 sobre una base con 001–004 conservando sus datos", () => {
  const dir = mkdtempSync(join(tmpdir(), "notes-upgrade-"));
  let db = openNotesDatabase(dir);
  try {
    db.exec(
      "DROP TABLE vault_attempts; DROP TABLE vault; DROP TABLE notes; DROP TABLE notes_fts; DELETE FROM schema_migrations",
    );
    for (const name of ["001_init", "002_note_title", "003_archive", "004_private"]) {
      db.exec(readFileSync(new URL(`./migrations/${name}.sql`, import.meta.url), "utf8"));
      db.run(
        "INSERT INTO schema_migrations VALUES (?, ?, ?)",
        Number(name.slice(0, 3)),
        name,
        "fecha",
      );
    }
    db.run(
      "INSERT INTO notes (id, title, body_md, created_at, updated_at, private, secret) VALUES (?, ?, ?, ?, ?, ?, ?)",
      "uno",
      "Título",
      "",
      "creada",
      "editada",
      1,
      "cifrado",
    );
    db.run("INSERT INTO vault VALUES (1, ?)", "envoltura");
    const before = db.all<Record<string, unknown>>("SELECT * FROM notes");
    db.close();
    db = openNotesDatabase(dir);
    expect(db.all("SELECT * FROM notes")).toEqual(before.map((row) => ({ ...row, orphaned: 0 })));
    expect(db.get("SELECT record FROM vault")).toEqual({ record: "envoltura" });
    expect(db.get("SELECT MAX(version) AS version FROM schema_migrations")).toEqual({ version: 5 });
    for (const purpose of ["password", "recovery"])
      db.run("INSERT INTO vault_attempts (purpose) VALUES (?)", purpose);
    expect(db.all("SELECT * FROM vault_attempts ORDER BY purpose")).toEqual([
      { purpose: "password", failures: 0, retry_at: 0 },
      { purpose: "recovery", failures: 0, retry_at: 0 },
    ]);
    expect(() => db.run("INSERT INTO vault_attempts (purpose) VALUES ('other')")).toThrow();
    expect(() => db.run("UPDATE notes SET orphaned = 2")).toThrow();
    db.close();
    db = openNotesDatabase(dir);
    expect(db.all("SELECT * FROM notes")).toEqual(before.map((row) => ({ ...row, orphaned: 0 })));
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

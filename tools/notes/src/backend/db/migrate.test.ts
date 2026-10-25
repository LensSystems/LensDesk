import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { openNotesDatabase } from "./driver.ts";

it("migra una copia de la base anterior sin cambiar títulos, fechas ni otros datos", () => {
  const directory = mkdtempSync(join(tmpdir(), "notes-migration-"));
  try {
    const original = join(directory, "original");
    let db = openNotesDatabase(original);
    db.exec(
      "DROP TABLE vault_attempts; DROP TABLE vault; DROP TABLE notes; DROP TABLE notes_fts; DELETE FROM schema_migrations WHERE version >= 2;",
    );
    db.exec(readFileSync(new URL("./migrations/001_init.sql", import.meta.url), "utf8"));
    const bodies = [
      "# Uno\n\nCuerpo",
      "\n  \n# Dos\r\n\r\nTexto",
      "# Distinto\n\nConservar",
      "Texto sin encabezado",
      "### Cinco\nTexto",
      "# Seis\n\n\nCuerpo",
      "# Siete",
      "    # comentario\n    echo hola\n",
      "\t# comentario\n\techo hola\n",
      "   # Ocho ###\n\nCuerpo",
    ];
    const titles = [
      "Uno",
      "Dos",
      "Tres",
      "Cuatro",
      "Cinco",
      "Seis",
      "Siete",
      "comentario",
      "comentario",
      "Ocho",
    ];
    bodies.forEach((body, index) => {
      db.run(
        "INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?)",
        String(index),
        titles[index] ?? "",
        body,
        index % 2,
        "creada",
        "editada",
        index === 1 ? "borrada" : null,
      );
    });
    const before = db.all<Record<string, string>>("SELECT * FROM notes ORDER BY id");
    const triggers = db.all(
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
    );
    db.close();
    const copy = join(directory, "copy");
    db = openNotesDatabase(copy);
    db.close();
    copyFileSync(join(original, "notes.db"), join(copy, "notes.db"));
    db = openNotesDatabase(copy);
    const after = db.all<Record<string, string>>("SELECT * FROM notes ORDER BY id");
    const expectedBodies = [
      "Cuerpo",
      "\n  \nTexto",
      bodies[2],
      bodies[3],
      bodies[4],
      "\nCuerpo",
      "",
      bodies[7],
      bodies[8],
      "Cuerpo",
    ];
    expect(after).toEqual(
      before.map((row, index) => ({
        ...row,
        archived_at: null,
        private: 0,
        orphaned: 0,
        secret: null,
        body_md: expectedBodies[index],
      })),
    );
    expect(
      db.all("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name"),
    ).toEqual(triggers);
    expect(db.all("SELECT rowid FROM notes_fts WHERE notes_fts MATCH 'Dos'")).toHaveLength(1);
    db.close();
    db = openNotesDatabase(copy);
    expect(db.all("SELECT * FROM notes ORDER BY id")).toEqual(after);
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

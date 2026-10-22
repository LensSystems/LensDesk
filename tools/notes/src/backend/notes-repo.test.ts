import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestContext } from "@lensdesk/sdk/backend/testing";
import { afterEach, describe, expect, it } from "vitest";
import { openNotesDatabase } from "./db/driver.ts";
import { createNotesRepository } from "./notes-repo.ts";

const directories: string[] = [];
function setup() {
  const dataDir = mkdtempSync(join(tmpdir(), "lensdesk-notes-"));
  directories.push(dataDir);
  const context = createTestContext({ dataDir });
  const db = openNotesDatabase(context.dataDir);
  let tick = 0;
  const repo = createNotesRepository(db, () => new Date(Date.UTC(2025, 0, 1, 0, 0, tick++)));
  return { dataDir, db, repo };
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("backend de Notas", () => {
  it("crea y migra la base al abrirla", () => {
    const { dataDir, db } = setup();
    expect(readdirSync(dataDir)).toContain("notes.db");
    for (const table of ["notes", "notes_fts", "schema_migrations"]) {
      expect(db.get("SELECT name FROM sqlite_master WHERE name = ?", table)).toBeTruthy();
    }
    expect(
      db.get<{ version: number }>(
        "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
      ),
    ).toEqual({
      version: 3,
    });
    db.close();
  });

  it("mantiene FTS actualizado al crear, editar y borrar definitivamente", () => {
    const { db, repo } = setup();
    const item = repo.create({ body_md: "# Antiguo" });
    expect(repo.search({ query: "Ant" })).toHaveLength(1);
    repo.update({ id: item.id, body_md: "# Nuevo" });
    expect(repo.search({ query: "Anti" })).toHaveLength(0);
    expect(repo.search({ query: "Nue" })).toHaveLength(1);
    db.run("DELETE FROM notes WHERE id = ?", item.id);
    expect(repo.search({ query: "Nue" })).toHaveLength(0);
    db.close();
  });

  it("valida títulos y los conserva al actualizar solo el cuerpo", () => {
    const { db, repo } = setup();
    const item = repo.create({ body_md: "# Cuerpo" });
    expect(item.title).toBe("");
    expect(repo.rename({ id: item.id, title: "a".repeat(200) }).title).toHaveLength(200);
    expect(repo.update({ id: item.id, body_md: "otro" }).title).toHaveLength(200);
    expect(repo.update({ id: item.id, body_md: "otro", title: "Explícito" }).title).toBe(
      "Explícito",
    );
    expect(repo.search({ query: "Explíc" })).toHaveLength(1);
    for (const title of ["a".repeat(201), "a\nb", "a\rb", 42, null]) {
      for (const call of [
        () => repo.rename({ id: item.id, title }),
        () => repo.create({ body_md: "", title }),
        () => repo.update({ id: item.id, body_md: "", title }),
      ])
        expect(call).toThrow(expect.objectContaining({ code: "E_INVALID_PARAMS" }));
    }
    expect(() => repo.rename({ id: "ausente", title: "x" })).toThrow(
      expect.objectContaining({ code: "E_NOT_FOUND" }),
    );
    db.close();
  });

  it("escapa operadores de FTS y busca por prefijo", () => {
    const { db, repo } = setup();
    repo.create({ body_md: 'Comillas " * : (paréntesis)' });
    for (const query of ['"', "*", ":", "(", "paren"]) {
      expect(() => repo.search({ query })).not.toThrow();
    }
    expect(repo.search({ query: "paren" })).toHaveLength(1);
    db.close();
  });

  it("mueve notas a papelera, las restaura y vacía solo las borradas", () => {
    const { db, repo } = setup();
    const trashed = repo.create({ body_md: "Papelera" });
    const kept = repo.create({ body_md: "Vigente" });
    repo.trash({ id: trashed.id });
    expect(repo.list({})).toHaveLength(1);
    expect(repo.list({ trashed: true })).toHaveLength(1);
    expect(repo.search({ query: "Papelera" })).toHaveLength(0);
    repo.restore({ id: trashed.id });
    expect(repo.search({ query: "Papelera" })).toHaveLength(1);
    repo.trash({ id: trashed.id });
    repo.emptyTrash({});
    expect(repo.get({ id: kept.id })).toBeTruthy();
    expect(db.get("SELECT id FROM notes WHERE id = ?", trashed.id)).toBeUndefined();
    db.close();
  });

  it("responde E_NOT_FOUND cuando la nota no existe", () => {
    const { db, repo } = setup();
    for (const call of [
      () => repo.get({ id: "no-existe" }),
      () => repo.update({ id: "no-existe", body_md: "x" }),
      () => repo.setPinned({ id: "no-existe", pinned: true }),
      () => repo.trash({ id: "no-existe" }),
      () => repo.restore({ id: "no-existe" }),
    ])
      expect(call).toThrow(expect.objectContaining({ code: "E_NOT_FOUND" }));
    expect(() => repo.get({ id: 3 })).toThrow(
      expect.objectContaining({ code: "E_INVALID_PARAMS" }),
    );
    db.close();
  });

  it("ordena las fijadas primero y conserva el título independiente", () => {
    const { db, repo } = setup();
    const first = repo.create({ title: "Título inicial", body_md: "  \n\n### Otro título\nTexto" });
    const second = repo.create({ body_md: "\n  \n" });
    repo.setPinned({ id: first.id, pinned: true });
    expect(first.title).toBe("Título inicial");
    expect(second.title).toBe("");
    expect(repo.list({}).map((item) => item.id)).toEqual([first.id, second.id]);
    db.close();
  });

  it("busca en una base de diez mil notas con mediana menor a 100 ms", () => {
    const { db, repo } = setup();
    db.transaction(() => {
      for (let i = 0; i < 10_000; i += 1) {
        const timestamp = new Date(Date.UTC(2025, 0, 1) + i).toISOString();
        db.run(
          "INSERT INTO notes (id, title, body_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          `note-${i}`,
          `Documento ${i}`,
          i % 100 === 0 ? "needle-payload" : `contenido ordinario ${i}`,
          timestamp,
          timestamp,
        );
      }
    });
    const durations: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const started = performance.now();
      expect(repo.search({ query: "needle" })).toHaveLength(100);
      durations.push(performance.now() - started);
    }
    durations.sort((a, b) => a - b);
    expect(durations[2]).toBeLessThan(100);
    db.close();
  });

  it("guarda el título sin espacios al principio ni al final", () => {
    const { db, repo } = setup();
    const created = repo.create({ body_md: "x", title: "  Tema ### " });
    expect(created.title).toBe("Tema ###");
    db.close();
  });
});

describe("notas archivadas", () => {
  it("excluye archivadas de notas y búsqueda, permite editarlas y desarchivarlas", () => {
    const { db, repo } = setup();
    const item = repo.create({ title: "Archivo", body_md: "Contenido" });
    const archived = repo.archive({ id: item.id });
    expect(archived.archived_at).toBeTruthy();
    expect(repo.list({})).toEqual([]);
    expect(repo.list({ trashed: false })).toEqual([]);
    expect(repo.search({ query: "Archivo" })).toEqual([]);
    expect(repo.search({ query: "" })).toEqual([]);
    expect(repo.list({ view: "archived" })).toEqual([archived]);
    expect(repo.update({ id: item.id, body_md: "Editado" }).body_md).toBe("Editado");
    expect(repo.unarchive({ id: item.id }).archived_at).toBeNull();
    expect(repo.list({ view: "notes" })).toHaveLength(1);
    expect(repo.search({ query: "Editado" })).toHaveLength(1);
    expect(repo.list({ view: "archived" })).toEqual([]);
    db.close();
  });

  it("conserva el archivo al pasar por papelera y restaurar", () => {
    const { db, repo } = setup();
    const item = repo.create({ body_md: "Archivo" });
    const archived = repo.archive({ id: item.id });
    repo.trash({ id: item.id });
    expect(repo.list({ view: "archived" })).toEqual([]);
    expect(repo.list({ view: "trash" })[0]?.archived_at).toBe(archived.archived_at);
    repo.restore({ id: item.id });
    expect(repo.list({ view: "notes" })).toEqual([]);
    expect(repo.list({ view: "archived" })[0]?.id).toBe(item.id);
    expect(repo.list({ trashed: true })).toEqual([]);
    db.close();
  });

  it("valida las operaciones y la vista", () => {
    const { db, repo } = setup();
    for (const method of ["archive", "unarchive"] as const) {
      for (const params of [null, {}, { id: 1 }, { id: "x", extra: true }])
        expect(() => repo[method](params)).toThrow(
          expect.objectContaining({ code: "E_INVALID_PARAMS" }),
        );
      expect(() => repo[method]({ id: "ausente" })).toThrow(
        expect.objectContaining({ code: "E_NOT_FOUND" }),
      );
    }
    expect(() => repo.list({ view: "invalid" })).toThrow(
      expect.objectContaining({ code: "E_INVALID_PARAMS" }),
    );
    db.close();
  });
});

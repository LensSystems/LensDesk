import { randomUUID } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";
import type { Db } from "./db/driver.ts";
import {
  assertObject,
  createSchema,
  parse,
  renameSchema,
  string,
  updateSchema,
} from "./note-validation.ts";
import type { Vault } from "./vault.ts";
import { createVaultRepository } from "./vault-repo.ts";

export { createSchema, parse, renameSchema, updateSchema } from "./note-validation.ts";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  private?: boolean;
  orphaned?: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at: string | null;
};
type StoredNote = Omit<Note, "pinned" | "private" | "orphaned"> & {
  orphaned: number;
  pinned: number;
  private: number;
  secret: string | null;
};

export function createNotesRepository(
  db: Db,
  now: () => Date = () => new Date(),
  suppliedVault?: Vault,
) {
  const { vault, methods, rebuildIndex, checkpoint } = createVaultRepository(
    db,
    now,
    suppliedVault,
  );
  function editable(id: string) {
    const row = stored(id);
    if (row.orphaned) throw new LensError("E_PERMISSION_DENIED", "Note cannot be opened");
    return row;
  }
  function note(row: StoredNote, includeBody = false): Note {
    const { secret, private: isPrivate, orphaned, ...fields } = row;
    // Las listas y búsquedas nunca incluyen cuerpos privados, incluso desbloqueadas.
    return {
      ...fields,
      ...(orphaned ? { orphaned: true } : {}),
      pinned: Boolean(row.pinned),
      private: Boolean(isPrivate),
      body_md: isPrivate
        ? includeBody && !orphaned
          ? vault.decrypt(secret as string, row.id)
          : ""
        : row.body_md,
    };
  }
  function stored(id: string): StoredNote {
    const row = db.get<StoredNote>("SELECT * FROM notes WHERE id = ?", id);
    if (!row) throw new LensError("E_NOT_FOUND", "Note not found");
    return row;
  }
  function requiredNote(_db: Db, id: string): Note {
    return note(stored(id), true);
  }
  return {
    ...methods,
    setPrivate(params: unknown) {
      const v = assertObject(params, ["id", "private"]);
      const id = string(v.id, "id");
      if (typeof v.private !== "boolean")
        throw new LensError("E_INVALID_PARAMS", "private must be boolean");
      const row = editable(id);
      if (!vault.unlocked()) throw new LensError("E_PERMISSION_DENIED", "Vault locked");
      const body = row.private ? vault.decrypt(row.secret as string, id) : row.body_md;
      const secret = v.private ? vault.encrypt(body, id) : null;
      // Cambio e índice en la misma transacción: un corte no deja términos privados en el FTS.
      db.transaction(() => {
        db.run(
          "UPDATE notes SET private = ?, secret = ?, body_md = ?, updated_at = ? WHERE id = ?",
          v.private ? 1 : 0,
          secret,
          v.private ? "" : body,
          now().toISOString(),
          id,
        );
        if (v.private) rebuildIndex();
      });
      if (v.private) checkpoint();
      return requiredNote(db, id);
    },
    create(params: unknown) {
      const values = parse(createSchema, params);
      const body = string(values.body_md, "body_md");
      const timestamp = now().toISOString();
      const id = randomUUID();
      db.run(
        "INSERT INTO notes (id, title, body_md, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        id,
        values.title ?? "",
        body,
        timestamp,
        timestamp,
      );
      return requiredNote(db, id);
    },
    update(params: unknown) {
      const values = parse(updateSchema, params);
      const id = string(values.id, "id");
      const body = string(values.body_md, "body_md");
      const timestamp = now().toISOString();
      const row = editable(id);
      if (row.private) vault.decrypt(row.secret as string, id);
      db.run(
        "UPDATE notes SET secret = ?, title = ?, body_md = ?, updated_at = ? WHERE id = ?",
        row.private ? vault.encrypt(body, id) : null,
        values.title ?? requiredNote(db, id).title,
        row.private ? "" : body,
        timestamp,
        id,
      );
      return requiredNote(db, id);
    },
    rename(params: unknown) {
      const { id, title } = parse(renameSchema, params);
      editable(id);
      requiredNote(db, id);
      db.run(
        "UPDATE notes SET title = ?, updated_at = ? WHERE id = ?",
        title,
        now().toISOString(),
        id,
      );
      return requiredNote(db, id);
    },
    get(params: unknown) {
      const values = assertObject(params, ["id"]);
      return requiredNote(db, string(values.id, "id"));
    },
    list(params: unknown) {
      const values = assertObject(params, [], ["trashed", "view"]);
      if (values.trashed !== undefined && typeof values.trashed !== "boolean")
        throw new LensError("E_INVALID_PARAMS", "trashed must be a boolean");
      if (
        values.view !== undefined &&
        (typeof values.view !== "string" || !["notes", "archived", "trash"].includes(values.view))
      )
        throw new LensError("E_INVALID_PARAMS", "Invalid notes view");
      const view = values.view ?? (values.trashed === true ? "trash" : "notes");
      const condition =
        view === "trash"
          ? "deleted_at IS NOT NULL"
          : `deleted_at IS NULL AND archived_at IS ${view === "archived" ? "NOT " : ""}NULL`;
      return db
        .all<StoredNote>(
          `SELECT * FROM notes WHERE ${condition} ORDER BY pinned DESC, updated_at DESC`,
        )
        .map((row) => note(row));
    },
    search(params: unknown) {
      const values = assertObject(params, ["query"]);
      const query = string(values.query, "query").trim();
      if (!query) return this.list({});
      const expression = query
        .split(/\s+/)
        .map((term) => `"${term.replaceAll('"', '""')}"*`)
        .join(" ");
      return db
        .all<StoredNote>(
          "SELECT notes.* FROM notes_fts JOIN notes ON notes.rowid = notes_fts.rowid WHERE notes_fts MATCH ? AND notes.deleted_at IS NULL AND notes.archived_at IS NULL ORDER BY notes.pinned DESC, notes.updated_at DESC",
          expression,
        )
        .map((row) => note(row));
    },
    setPinned(params: unknown) {
      const values = assertObject(params, ["id", "pinned"]);
      const id = string(values.id, "id");
      editable(id);
      if (typeof values.pinned !== "boolean")
        throw new LensError("E_INVALID_PARAMS", "pinned must be a boolean");
      db.run(
        "UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?",
        values.pinned ? 1 : 0,
        now().toISOString(),
        id,
      );
      return note(stored(id));
    },
    archive(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      editable(id);
      const timestamp = now().toISOString();
      db.run(
        "UPDATE notes SET archived_at = ?, updated_at = ? WHERE id = ?",
        timestamp,
        timestamp,
        id,
      );
      return note(stored(id));
    },
    unarchive(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      editable(id);
      db.run(
        "UPDATE notes SET archived_at = NULL, updated_at = ? WHERE id = ?",
        now().toISOString(),
        id,
      );
      return note(stored(id));
    },
    trash(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      if (stored(id).orphaned && stored(id).deleted_at) return note(stored(id));
      db.run(
        "UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
        now().toISOString(),
        now().toISOString(),
        id,
      );
      return note(stored(id));
    },
    restore(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      editable(id);
      db.run(
        "UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        now().toISOString(),
        id,
      );
      return note(stored(id));
    },
    deleteForever(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      if (!stored(id).deleted_at)
        throw new LensError("E_PERMISSION_DENIED", "Note is not in the trash");
      db.run("DELETE FROM notes WHERE id = ?", id);
      return { deleted: true };
    },
    emptyTrash(params: unknown) {
      assertObject(params, []);
      db.run("DELETE FROM notes WHERE deleted_at IS NOT NULL");
      return { deleted: true };
    },
  };
}

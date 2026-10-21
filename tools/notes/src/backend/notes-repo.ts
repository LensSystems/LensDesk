import { randomUUID } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";
import type { Db } from "./db/driver.ts";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
type StoredNote = Omit<Note, "pinned"> & { pinned: number };

function assertObject(
  params: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  if (!params || typeof params !== "object" || Array.isArray(params))
    throw new LensError("E_INVALID_PARAMS", "Expected an object");
  const value = params as Record<string, unknown>;
  if (Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key)))
    throw new LensError("E_INVALID_PARAMS", "Unexpected parameter");
  for (const key of required)
    if (!(key in value)) throw new LensError("E_INVALID_PARAMS", "Missing parameter");
  return value;
}
function string(value: unknown, key: string): string {
  if (typeof value !== "string") throw new LensError("E_INVALID_PARAMS", `${key} must be a string`);
  return value;
}
function title(value: unknown): string {
  // Una sola línea de hasta 200 caracteres, sin espacios al principio ni al final.
  const text = string(value, "title").trim();
  if (text.length > 200 || /[\r\n\u2028\u2029]/.test(text))
    throw new LensError("E_INVALID_PARAMS", "Invalid note title");
  return text;
}
type Validator<T> = (params: unknown) => T;
export const createSchema: Validator<{ body_md: string; title?: string }> = (params) => {
  const values = assertObject(params, ["body_md"], ["title"]);
  return {
    body_md: string(values.body_md, "body_md"),
    ...(values.title === undefined ? {} : { title: title(values.title) }),
  };
};
export const updateSchema: Validator<{ id: string; body_md: string; title?: string }> = (
  params,
) => {
  const values = assertObject(params, ["id", "body_md"], ["title"]);
  return {
    id: string(values.id, "id"),
    body_md: string(values.body_md, "body_md"),
    ...(values.title === undefined ? {} : { title: title(values.title) }),
  };
};
export const renameSchema: Validator<{ id: string; title: string }> = (params) => {
  const values = assertObject(params, ["id", "title"]);
  return { id: string(values.id, "id"), title: title(values.title) };
};

export function parse<T>(validate: Validator<T>, params: unknown): T {
  return validate(params);
}
function note(row: StoredNote | undefined): Note | null {
  return row ? { ...row, pinned: Boolean(row.pinned) } : null;
}
function requiredNote(db: Db, id: string): Note {
  const found = note(db.get<StoredNote>("SELECT * FROM notes WHERE id = ?", id));
  if (!found) throw new LensError("E_NOT_FOUND", "Note not found");
  return found;
}

export function createNotesRepository(db: Db, now: () => Date = () => new Date()) {
  return {
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
      db.run(
        "UPDATE notes SET title = ?, body_md = ?, updated_at = ? WHERE id = ?",
        values.title ?? requiredNote(db, id).title,
        body,
        timestamp,
        id,
      );
      return requiredNote(db, id);
    },
    rename(params: unknown) {
      const { id, title } = parse(renameSchema, params);
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
      const values = assertObject(params, [], ["trashed"]);
      if (values.trashed !== undefined && typeof values.trashed !== "boolean")
        throw new LensError("E_INVALID_PARAMS", "trashed must be a boolean");
      const trashed = values.trashed === true;
      return db
        .all<StoredNote>(
          `SELECT * FROM notes WHERE deleted_at IS ${trashed ? "NOT " : ""}NULL ORDER BY pinned DESC, updated_at DESC`,
        )
        .map((row) => note(row) as Note);
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
          "SELECT notes.* FROM notes_fts JOIN notes ON notes.rowid = notes_fts.rowid WHERE notes_fts MATCH ? AND notes.deleted_at IS NULL ORDER BY notes.pinned DESC, notes.updated_at DESC",
          expression,
        )
        .map((row) => note(row) as Note);
    },
    setPinned(params: unknown) {
      const values = assertObject(params, ["id", "pinned"]);
      const id = string(values.id, "id");
      if (typeof values.pinned !== "boolean")
        throw new LensError("E_INVALID_PARAMS", "pinned must be a boolean");
      db.run(
        "UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?",
        values.pinned ? 1 : 0,
        now().toISOString(),
        id,
      );
      return requiredNote(db, id);
    },
    trash(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      db.run(
        "UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?",
        now().toISOString(),
        now().toISOString(),
        id,
      );
      return requiredNote(db, id);
    },
    restore(params: unknown) {
      const values = assertObject(params, ["id"]);
      const id = string(values.id, "id");
      db.run(
        "UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        now().toISOString(),
        id,
      );
      return requiredNote(db, id);
    },
    emptyTrash(params: unknown) {
      assertObject(params, []);
      db.run("DELETE FROM notes WHERE deleted_at IS NOT NULL");
      return { deleted: true };
    },
  };
}

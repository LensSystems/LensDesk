import { randomUUID } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";
import type { Db } from "./db/driver.ts";
import { createVault, type Vault, type VaultRecord } from "./vault.ts";

export type Note = {
  id: string;
  title: string;
  body_md: string;
  private?: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at: string | null;
};
type StoredNote = Omit<Note, "pinned" | "private"> & {
  pinned: number;
  private: number;
  secret: string | null;
};

export function assertObject(
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
export function string(value: unknown, key: string): string {
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
export function createNotesRepository(
  db: Db,
  now: () => Date = () => new Date(),
  vault: Vault = createVault(),
) {
  function note(row: StoredNote, includeBody = false): Note {
    const { secret, private: isPrivate, ...fields } = row;
    // Las listas y búsquedas nunca incluyen cuerpos privados, incluso desbloqueadas.
    return {
      ...fields,
      pinned: Boolean(row.pinned),
      private: Boolean(isPrivate),
      body_md: isPrivate
        ? includeBody
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
  function record() {
    return db.get<{ record: string }>("SELECT record FROM vault WHERE id = 1");
  }
  function load(): VaultRecord | undefined {
    const row = record();
    return row ? (JSON.parse(row.record) as VaultRecord) : undefined;
  }
  // Con secure_delete (driver.ts) SQLite sobrescribe con ceros lo borrado; aquí se rehace el índice
  // FTS (que conserva los términos antiguos) y se vacía el WAL, que guarda copias de páginas.
  function rebuildIndex() {
    db.exec("INSERT INTO notes_fts(notes_fts) VALUES ('rebuild')");
  }
  function purge() {
    rebuildIndex();
    checkpoint();
  }
  function checkpoint() {
    const result = db.get<{ busy: number }>("PRAGMA wal_checkpoint(TRUNCATE)");
    if (result?.busy) throw new LensError("E_INTERNAL", "Could not clear the database log");
  }
  // Una purga interrumpida (cierre o fallo) se completa al abrir.
  checkpoint();
  function save(value: VaultRecord) {
    db.run("INSERT OR REPLACE INTO vault (id, record) VALUES (1, ?)", JSON.stringify(value));
  }
  function password(value: unknown) {
    const text = string(value, "password");
    if ([...text].length < 6 || [...text].length > 10)
      throw new LensError("E_INVALID_PARAMS", "Password must have 6–10 characters");
    return text;
  }
  function pair(value: unknown): [string, string] {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      value.some((v) => typeof v !== "string" || !v.trim())
    )
      throw new LensError("E_INVALID_PARAMS", "Expected two nonempty strings");
    return value as [string, string];
  }
  // Solo al guardar respuestas nuevas: comprobar las ya guardadas no debe bloquear a nadie.
  function answers(value: unknown): [string, string] {
    const values = pair(value);
    if (values.some((text) => [...text.trim()].length < 2 || [...text.trim()].length > 20))
      throw new LensError("E_INVALID_PARAMS", "Invalid answer length");
    return values;
  }
  return {
    vaultStatus(params: unknown) {
      assertObject(params, []);
      return {
        configured: Boolean(record()),
        unlocked: vault.unlocked(),
        questions: load()?.questions ?? [],
      };
    },
    vaultSetup(params: unknown) {
      const v = assertObject(params, ["password", "questions", "answers"]);
      const pass = password(v.password);
      const questions = pair(v.questions);
      const responses = answers(v.answers);
      if (record()) throw new LensError("E_PERMISSION_DENIED", "Vault already configured");
      // Bases anteriores a secure_delete pueden guardar cuerpos viejos en páginas libres: se
      // reescribe la base una vez, antes de que exista ninguna nota privada.
      db.exec("VACUUM");
      checkpoint();
      vault.setup(pass, questions, responses, (value) => {
        save(value);
        purge();
      });
      return { unlocked: true };
    },
    vaultUnlock(params: unknown) {
      const v = assertObject(params, ["password"]);
      vault.unlock(load(), string(v.password, "password"));
      return { unlocked: true };
    },
    vaultLock(params: unknown) {
      assertObject(params, []);
      vault.lock();
      return { unlocked: false };
    },
    vaultReset(params: unknown) {
      const v = assertObject(params, ["password", "answers"]);
      // La purga borra del disco la envoltura sustituida (y la contraseña anterior con ella).
      vault.reset(load(), pair(v.answers), password(v.password), (value) => {
        save(value);
        purge();
      });
      return { unlocked: true };
    },
    setPrivate(params: unknown) {
      const v = assertObject(params, ["id", "private"]);
      const id = string(v.id, "id");
      if (typeof v.private !== "boolean")
        throw new LensError("E_INVALID_PARAMS", "private must be boolean");
      const row = stored(id);
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
      const row = stored(id);
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
      db.run(
        "UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        now().toISOString(),
        id,
      );
      return note(stored(id));
    },
    emptyTrash(params: unknown) {
      assertObject(params, []);
      db.run("DELETE FROM notes WHERE deleted_at IS NOT NULL");
      return { deleted: true };
    },
  };
}

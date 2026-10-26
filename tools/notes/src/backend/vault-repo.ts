import { LensError } from "@lensdesk/sdk/errors";
import type { Db } from "./db/driver.ts";
import { assertObject, string } from "./note-validation.ts";
import { createVault, type Vault, type VaultRecord } from "./vault.ts";
import type { Purpose } from "./vault-attempts.ts";

export function createVaultRepository(db: Db, now: () => Date, suppliedVault?: Vault) {
  const vault =
    suppliedVault ??
    createVault({
      now: () => now().getTime(),
      attempts: {
        read(purpose: Purpose) {
          const row = db.get<{ failures: number; retry_at: number }>(
            "SELECT failures, retry_at FROM vault_attempts WHERE purpose = ?",
            purpose,
          );
          return { failures: row?.failures ?? 0, retryAt: row?.retry_at ?? 0 };
        },
        save(purpose, value) {
          db.run(
            "INSERT OR REPLACE INTO vault_attempts (purpose, failures, retry_at) VALUES (?, ?, ?)",
            purpose,
            value.failures,
            value.retryAt,
          );
        },
      },
    });
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
    vault,
    rebuildIndex,
    checkpoint,
    methods: {
      vaultWipe(params: unknown) {
        assertObject(params, []);
        if (
          !record() ||
          !Object.values(vault.lockout()).some((value) =>
            ["limit", "last", "exhausted"].includes(value.stage),
          )
        )
          throw new LensError("E_PERMISSION_DENIED", "Reset not allowed");
        const orphaned = db.transaction(() => {
          const count =
            db.get<{ count: number }>(
              "SELECT COUNT(*) AS count FROM notes WHERE private = 1 AND orphaned = 0",
            )?.count ?? 0;
          const timestamp = now().toISOString();
          db.run("DELETE FROM vault");
          db.run("UPDATE vault_attempts SET failures = 0, retry_at = 0");
          db.run(
            "UPDATE notes SET orphaned = 1, pinned = 0, deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE private = 1 AND orphaned = 0",
            timestamp,
            timestamp,
          );
          return count;
        });
        vault.lock();
        vault.resetAttempts();
        purge();
        return { configured: false, orphaned };
      },

      vaultStatus(params: unknown) {
        assertObject(params, []);
        return {
          configured: Boolean(record()),
          unlocked: vault.unlocked(),
          questions: load()?.questions ?? [],
          lockout: vault.lockout(),
          privateCount:
            db.get<{ count: number }>(
              "SELECT COUNT(*) AS count FROM notes WHERE private = 1 AND orphaned = 0",
            )?.count ?? 0,
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
    },
  };
}

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { openNotesDatabase } from "./db/driver.ts";
import { createNotesRepository } from "./notes-repo.ts";
import { checkParams, createVault } from "./vault.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function setup() {
  let time = 0;
  const vault = createVault({ now: () => time, scrypt: { N: 16, r: 1, p: 1, length: 32 } });
  const dir = mkdtempSync(join(tmpdir(), "notes-vault-"));
  dirs.push(dir);
  const db = openNotesDatabase(dir);
  const repo = createNotesRepository(db, undefined, vault);
  repo.vaultSetup({
    password: "Abc123!",
    questions: ["Ciudad", "Nombre"],
    answers: [" MÉXICO ", "  María   José "],
  });
  return {
    vault,
    db,
    repo,
    dir,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
it("cifra con nonce nuevo y autentica el contenido y la identidad", () => {
  const { vault, db } = setup();
  const a = vault.encrypt("secreto", "uno");
  const b = vault.encrypt("secreto", "uno");
  expect(JSON.parse(a).nonce).not.toBe(JSON.parse(b).nonce);
  expect(vault.decrypt(a, "uno")).toBe("secreto");
  expect(() => vault.decrypt(a, "otro")).toThrow(
    expect.objectContaining({ code: "E_PERMISSION_DENIED" }),
  );
  vault.lock();
  db.close();
});
it("restablece con respuestas normalizadas sin perder notas y conserva el bloqueo al reiniciar", () => {
  const { repo, db, vault, dir } = setup();
  const item = repo.create({ title: "Título visible", body_md: "contenido confidencial" });
  repo.setPrivate({ id: item.id, private: true });
  const before = db.get<{ record: string }>("SELECT record FROM vault")?.record;
  repo.vaultLock({});
  expect(() => repo.rename({ id: item.id, title: "No debe guardarse" })).toThrow(
    expect.objectContaining({ code: "E_PERMISSION_DENIED" }),
  );
  expect(repo.list({})[0]?.title).toBe("Título visible");
  expect(() => repo.vaultUnlock({ password: "incorrecta" })).toThrow(
    expect.objectContaining({ code: "E_PERMISSION_DENIED" }),
  );
  expect(() => repo.get({ id: item.id })).toThrow(
    expect.objectContaining({ code: "E_PERMISSION_DENIED" }),
  );
  expect(() => repo.update({ id: item.id, body_md: "cambio" })).toThrow();
  expect(() => repo.setPrivate({ id: item.id, private: false })).toThrow();
  repo.vaultReset({ password: "Nuevo12", answers: ["mexico", "MARIA JOSE"] });
  expect(db.get<{ record: string }>("SELECT record FROM vault")?.record).not.toBe(before);
  expect(repo.get({ id: item.id }).body_md).toBe("contenido confidencial");
  repo.update({ id: item.id, body_md: "nuevo secreto" });
  expect(repo.list({})[0]?.body_md).toBe("");
  repo.setPrivate({ id: item.id, private: false });
  expect(repo.get({ id: item.id }).body_md).toBe("nuevo secreto");
  repo.setPrivate({ id: item.id, private: true });
  vault.lock();
  db.close();
  const reopened = openNotesDatabase(dir);
  const freshVault = createVault({ scrypt: { N: 16, r: 1, p: 1, length: 32 } });
  const freshRepo = createNotesRepository(reopened, undefined, freshVault);
  expect(freshRepo.vaultStatus({}).unlocked).toBe(false);
  expect(() => freshRepo.vaultUnlock({ password: "Abc123!" })).toThrow();
  freshRepo.vaultUnlock({ password: "Nuevo12" });
  expect(freshRepo.get({ id: item.id }).body_md).toBe("nuevo secreto");
  freshVault.lock();
  reopened.close();
});
it("limpia el cuerpo anterior del índice, la base y el WAL", () => {
  const { repo, db, vault, dir } = setup();
  const secret = "TextoIrrepetibleConfidencial938174";
  const item = repo.create({ title: "Buscable", body_md: secret });
  expect(repo.search({ query: secret })).toHaveLength(1);
  repo.setPrivate({ id: item.id, private: true });
  expect(repo.search({ query: secret })).toHaveLength(0);
  expect(repo.search({ query: "Buscable" })[0]?.body_md).toBe("");
  for (const suffix of ["", "-wal"]) {
    const file = join(dir, `notes.db${suffix}`);
    if (existsSync(file)) expect(readFileSync(file).includes(Buffer.from(secret))).toBe(false);
  }
  vault.lock();
  db.close();
  expect(readFileSync(join(dir, "notes.db")).includes(Buffer.from(secret))).toBe(false);
});
it("bloquea tras diez minutos y aplica una espera creciente desde el quinto fallo", () => {
  const { repo, db, vault, advance } = setup();
  const item = repo.create({ body_md: "secreto" });
  repo.setPrivate({ id: item.id, private: true });
  advance(600_000);
  expect(() => repo.get({ id: item.id })).toThrow();
  for (let i = 1; i < 5; i++) {
    expect(() => repo.vaultUnlock({ password: "errónea" })).toThrow(
      `Invalid credentials. ${5 - i} attempts left`,
    );
  }
  expect(() => repo.vaultUnlock({ password: "errónea" })).toThrow(
    "Too many attempts. Wait 30 seconds",
  );
  expect(() => repo.vaultUnlock({ password: "Abc123!" })).toThrow(
    "Too many attempts. Wait 30 seconds",
  );
  advance(30_000);
  for (const seconds of [60, 120, 240, 300]) {
    expect(() => repo.vaultUnlock({ password: "errónea" })).toThrow(
      `Too many attempts. Wait ${seconds} seconds`,
    );
    advance(seconds * 1000 - 1000);
    expect(() => repo.vaultUnlock({ password: "Abc123!" })).toThrow(
      "Too many attempts. Wait 1 seconds",
    );
    advance(1000);
  }
  repo.vaultUnlock({ password: "Abc123!" });
  expect(repo.get({ id: item.id }).body_md).toBe("secreto");
  vault.lock();
  db.close();
});
it("valida manualmente los límites de contraseña y las dos preguntas", () => {
  const { repo, db, vault } = setup();
  expect(() => repo.vaultReset({ password: "corta", answers: ["a", "b"] })).toThrow(
    expect.objectContaining({ code: "E_INVALID_PARAMS" }),
  );
  expect(() => repo.vaultReset({ password: "demasiadolarga", answers: ["a", "b"] })).toThrow();
  expect(() => repo.vaultReset({ password: "Valida1", answers: ["a"] })).toThrow();
  vault.lock();
  db.close();
});

it.each([
  { N: 2 ** 21, r: 8, p: 1, length: 32 },
  { N: 3, r: 8, p: 1, length: 32 },
  { N: 16, r: 64, p: 1, length: 32 },
  { N: 16, r: 1, p: 32, length: 32 },
  { N: 16, r: 1, p: 1, length: 16 },
])("rechaza parámetros de derivación fuera de rango %o", (cost) => {
  expect(() => checkParams(cost)).toThrow(expect.objectContaining({ code: "E_INVALID_PARAMS" }));
});
it("acepta los parámetros por defecto y los de prueba", () => {
  expect(() => checkParams({ N: 32768, r: 8, p: 1, length: 32 })).not.toThrow();
  expect(() => checkParams({ N: 16, r: 1, p: 1, length: 32 })).not.toThrow();
});
it("si no se puede guardar la bóveda, la clave no queda activa", () => {
  const vault = createVault({ scrypt: { N: 16, r: 1, p: 1, length: 32 } });
  const dir = mkdtempSync(join(tmpdir(), "notes-vault-"));
  dirs.push(dir);
  const db = openNotesDatabase(dir);
  const repo = createNotesRepository(db, undefined, vault);
  const item = repo.create({ body_md: "secreto" });
  // Simula un fallo al guardar (por ejemplo, disco lleno).
  db.exec("CREATE TRIGGER fail_save BEFORE INSERT ON vault BEGIN SELECT RAISE(ABORT, 'full'); END");
  expect(() =>
    repo.vaultSetup({ password: "Abc123!", questions: ["A", "B"], answers: ["a", "b"] }),
  ).toThrow();
  expect(vault.unlocked()).toBe(false);
  expect(() => repo.setPrivate({ id: item.id, private: true })).toThrow(
    expect.objectContaining({ code: "E_PERMISSION_DENIED" }),
  );
  db.close();
});
it("restablecer borra del disco la envoltura con la contraseña anterior", () => {
  const { repo, db, dir } = setup();
  const old = JSON.parse(db.get<{ record: string }>("SELECT record FROM vault")?.record ?? "{}");
  repo.vaultReset({ answers: ["méxico", "maría josé"], password: "Nueva1!" });
  const salt = Buffer.from(old.password.salt);
  for (const suffix of ["", "-wal"]) {
    const file = join(dir, `notes.db${suffix}`);
    if (existsSync(file)) expect(readFileSync(file).includes(salt)).toBe(false);
  }
  db.close();
});
it("si falla el índice al hacer privada una nota, la nota sigue como estaba", () => {
  const { repo, db } = setup();
  const item = repo.create({ body_md: "palabraúnica" });
  db.exec(
    "CREATE TRIGGER fail_rebuild BEFORE UPDATE OF private ON notes BEGIN SELECT RAISE(ABORT, 'x'); END",
  );
  expect(() => repo.setPrivate({ id: item.id, private: true })).toThrow();
  db.exec("DROP TRIGGER fail_rebuild");
  expect(repo.get({ id: item.id })).toMatchObject({ private: false, body_md: "palabraúnica" });
  db.close();
});
it("limpia restos de una base anterior a secure_delete al crear la bóveda", () => {
  const secret = "historialantiguo".repeat(400);
  const dir = mkdtempSync(join(tmpdir(), "notes-vault-"));
  dirs.push(dir);
  const db = openNotesDatabase(dir);
  db.exec("PRAGMA secure_delete = OFF");
  const repo = createNotesRepository(
    db,
    undefined,
    createVault({ scrypt: { N: 16, r: 1, p: 1, length: 32 } }),
  );
  const item = repo.create({ body_md: secret });
  repo.update({ id: item.id, body_md: "corto" });
  db.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA secure_delete = ON");
  expect(readFileSync(join(dir, "notes.db")).includes(Buffer.from("historialantiguo"))).toBe(true);
  repo.vaultSetup({ password: "Abc123!", questions: ["A", "B"], answers: ["aa", "bb"] });
  repo.setPrivate({ id: item.id, private: true });
  for (const suffix of ["", "-wal"]) {
    const file = join(dir, `notes.db${suffix}`);
    if (existsSync(file))
      expect(readFileSync(file).includes(Buffer.from("historialantiguo"))).toBe(false);
  }
  db.close();
});

it.each(["password", "recovery"])("el éxito de %s limpia ambos contadores", (purpose) => {
  const { repo, db, vault, advance } = setup();
  const wrongPassword = () => repo.vaultUnlock({ password: "errónea" });
  const wrongRecovery = () => repo.vaultReset({ password: "Nueva1!", answers: ["no", "no"] });
  for (let i = 0; i < 4; i++) expect(wrongPassword).toThrow();
  expect(wrongRecovery).toThrow("Invalid credentials. 4 attempts left");
  expect(wrongPassword).toThrow("Wait 30 seconds");
  // La espera de contraseña permite seguir intentando respuestas.
  expect(wrongRecovery).toThrow("Invalid credentials. 3 attempts left");
  if (purpose === "password") {
    advance(30_000);
    repo.vaultUnlock({ password: "Abc123!" });
  } else repo.vaultReset({ password: "Nueva1!", answers: ["mexico", "maria jose"] });
  expect(wrongPassword).toThrow("Invalid credentials. 4 attempts left");
  expect(wrongRecovery).toThrow("Invalid credentials. 4 attempts left");
  vault.lock();
  db.close();
});

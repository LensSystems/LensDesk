import { generateKeyPairSync, sign, verify } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

// Canario del runtime: prueba desde el Bootstrap que el runner puede cargar node:sqlite con FTS5
// y Ed25519 de node:crypto. Si esto falla, el problema es de entorno/config, no del codigo.
describe("runtime canary", () => {
  it("runs node:sqlite with FTS5 under the test runner", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE docs USING fts5(title, body)");
    db.prepare("INSERT INTO docs (title, body) VALUES (?, ?)").run("hola", "lensdesk canary");
    const row = db.prepare("SELECT title FROM docs WHERE docs MATCH ?").get("canary");
    db.close();
    expect(row?.title).toBe("hola");
  });

  it("signs and verifies with Ed25519", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const message = Buffer.from("lensdesk", "utf8");
    const signature = sign(null, message, privateKey);
    expect(verify(null, message, publicKey, signature)).toBe(true);
    expect(verify(null, Buffer.from("tampered", "utf8"), publicKey, signature)).toBe(false);
  });
});

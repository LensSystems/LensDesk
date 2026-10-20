import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPackage, generateKeyPair, packTool, verifyPackage } from "@lensdesk/lenspkg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openHostDatabase } from "../db/driver.ts";
import { createToolInstaller } from "./installer.ts";

const roots: string[] = [];
async function temp() {
  const path = await mkdtemp(join(tmpdir(), "lensdesk-installer-"));
  roots.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const base = {
  id: "sample-tool",
  name: { es: "Muestra", en: "Sample" },
  description: { es: "Demo", en: "Demo" },
  version: "1.0.0",
  apiVersion: 1,
  icon: "Box",
  ui: { entry: "ui/index.html" },
  permissions: ["storage"],
  minHostVersion: "0.1.0",
};
async function packageAt(
  root: string,
  version: string,
  pair: ReturnType<typeof generateKeyPair>,
  signing = true,
) {
  const source = join(root, `source-${version}`);
  await mkdir(join(source, "ui"), { recursive: true });
  await writeFile(join(source, "lensdesk.tool.json"), JSON.stringify({ ...base, version }));
  await writeFile(join(source, "ui/index.html"), `<h1>${version}</h1>`);
  const file = join(root, `${version}.lenspkg`);
  await packTool(source, { outFile: file, signing: signing ? { ...pair, keyId: "test" } : null });
  return file;
}
function setup(root: string, developerMode = false) {
  const database = openHostDatabase(root);
  const pair = generateKeyPair();
  const installer = createToolInstaller({
    database,
    userData: root,
    trustedKeys: () => new Map([["test", pair.publicKeyPem]]),
    developerMode: () => developerMode,
    hostVersion: "0.1.0",
    now: () => "2026-10-15T00:00:00.000Z",
  });
  return { database, pair, installer };
}
describe("tool installer", () => {
  it("conserva E_PACKAGE_INVALID para bytes aleatorios y zip truncado", async () => {
    const root = await temp();
    const { database, pair, installer } = setup(root);
    try {
      const file = await packageAt(root, "1.0.0", pair);
      const bytes = await readFile(file);
      for (const damaged of [
        Buffer.from([17, 91, 0, 212, 38, 119]),
        bytes.subarray(0, bytes.length - 12),
      ]) {
        await writeFile(file, damaged);
        await expect(installer.install(file)).rejects.toMatchObject({ code: "E_PACKAGE_INVALID" });
        expect(await readdir(join(root, "tools"))).toEqual([]);
      }
    } finally {
      database.close();
    }
  });
  it("instala paquetes firmados y sin firma solo en modo desarrollador; limpia rechazos", async () => {
    const root = await temp();
    const { database, pair, installer } = setup(root);
    const signed = await packageAt(root, "1.0.0", pair);
    const installed = await installer.install(signed);
    expect(installed).toMatchObject({
      id: "sample-tool",
      signed: true,
      keyId: "test",
      installPath: join(root, "tools/sample-tool/1.0.0"),
    });
    const unsigned = await packageAt(root, "1.1.0", pair, false);
    await expect(installer.install(unsigned)).rejects.toMatchObject({ code: "E_UNSIGNED" });
    expect(await readdir(join(root, "tools", "sample-tool"))).toEqual(["1.0.0"]);
    const otherPair = generateKeyPair();
    const untrusted = await packageAt(root, "1.2.0", otherPair);
    await expect(installer.install(untrusted)).rejects.toMatchObject({
      code: "E_SIGNATURE_INVALID",
    });
    expect(await readdir(join(root, "tools", "sample-tool"))).toEqual(["1.0.0"]);
    database.close();
    const dev = setup(root, true);
    const devInstall = await dev.installer.install(unsigned);
    expect(devInstall).toMatchObject({ signed: false, keyId: null });
    dev.database.close();
  });
  it("avisa al actualizar, antes de borrar la versión anterior, y no al instalar", async () => {
    const root = await temp();
    const database = openHostDatabase(root);
    const pair = generateKeyPair();
    const seen: Array<{ id: string; oldStillThere: boolean }> = [];
    const installer = createToolInstaller({
      database,
      userData: root,
      trustedKeys: () => new Map(),
      developerMode: () => true,
      hostVersion: "0.1.0",
      onToolUpdated: (id) =>
        seen.push({ id, oldStillThere: existsSync(join(root, "tools", id, "1.0.0")) }),
    });
    await installer.install(await packageAt(root, "1.0.0", pair, false));
    expect(seen).toEqual([]);
    await installer.install(await packageAt(root, "2.0.0", pair, false));
    expect(seen).toEqual([{ id: "sample-tool", oldStillThere: true }]);
    expect(existsSync(join(root, "tools", "sample-tool", "1.0.0"))).toBe(false);
    database.close();
  });
  it("actualiza atómicamente, conserva datos y exige confirmación para downgrade", async () => {
    const root = await temp();
    const { database, pair, installer } = setup(root, true);
    await installer.install(await packageAt(root, "1.0.0", pair, false));
    database
      .prepare("INSERT INTO tool_kv (tool_id,key,value_json,updated_at) VALUES (?,?,?,?)")
      .run("sample-tool", "k", "1", "now");
    await mkdir(join(root, "tool-data", "sample-tool"), { recursive: true });
    await writeFile(join(root, "tool-data", "sample-tool", "keep"), "yes");
    await installer.install(await packageAt(root, "2.0.0", pair, false));
    expect(
      database.prepare("SELECT value_json FROM tool_kv WHERE tool_id = ?").get("sample-tool"),
    ).toEqual({ value_json: "1" });
    expect(await readFile(join(root, "tool-data/sample-tool/keep"), "utf8")).toBe("yes");
    const older = await packageAt(root, "1.5.0", pair, false);
    await expect(installer.install(older)).rejects.toMatchObject({ code: "E_DOWNGRADE_CONFIRM" });
    expect(installer.registry.get("sample-tool")?.version).toBe("2.0.0");
    expect(installer.getPendingDowngrade()).toEqual({
      toolId: "sample-tool",
      installedVersion: "2.0.0",
      version: "1.5.0",
    });
    await installer.confirmDowngrade("sample-tool", "1.5.0");
    expect(installer.registry.get("sample-tool")?.version).toBe("1.5.0");
    expect(installer.getPendingDowngrade()).toBeNull();
    await expect(installer.confirmDowngrade("sample-tool", "1.5.0")).rejects.toMatchObject({
      code: "E_INVALID_PARAMS",
    });
    database.close();
  });
  it("solo mantiene un downgrade pendiente y lo limpia al instalar o quitar su herramienta", async () => {
    const root = await temp();
    const { database, pair, installer } = setup(root, true);
    await installer.install(await packageAt(root, "2.0.0", pair, false));
    await expect(
      installer.install(await packageAt(root, "1.0.0", pair, false)),
    ).rejects.toMatchObject({
      code: "E_DOWNGRADE_CONFIRM",
    });
    await installer.install(await packageAt(root, "2.1.0", pair, false));
    expect(installer.getPendingDowngrade()).toBeNull();
    await expect(
      installer.install(await packageAt(root, "1.5.0", pair, false)),
    ).rejects.toMatchObject({
      code: "E_DOWNGRADE_CONFIRM",
    });
    await installer.remove("sample-tool", false);
    expect(installer.getPendingDowngrade()).toBeNull();
    database.close();
  });
  it("remove conserva o elimina tool_kv e tool-data; FK borra open_tabs en cascada", async () => {
    const root = await temp();
    const { database, pair } = setup(root, true);
    const onToolRemoved = vi.fn();
    const installer = createToolInstaller({
      database,
      userData: root,
      trustedKeys: () => new Map([["test", pair.publicKeyPem]]),
      developerMode: () => true,
      hostVersion: "0.1.0",
      onToolRemoved,
    });
    await installer.install(await packageAt(root, "1.0.0", pair, false));
    database
      .prepare("INSERT INTO tool_kv (tool_id,key,value_json,updated_at) VALUES (?,?,?,?)")
      .run("sample-tool", "k", "1", "now");
    database
      .prepare("INSERT INTO open_tabs (position,tool_id,active) VALUES (?,?,?)")
      .run(0, "sample-tool", 1);
    await mkdir(join(root, "tool-data/sample-tool"), { recursive: true });
    await installer.remove("sample-tool", false);
    expect(onToolRemoved).toHaveBeenCalledWith("sample-tool");
    expect(database.prepare("SELECT tool_id FROM open_tabs").all()).toEqual([]);
    expect(database.prepare("SELECT tool_id FROM tool_kv").all()).toHaveLength(1);
    expect(await readdir(join(root, "tool-data/sample-tool"))).toEqual([]);
    await installer.install(await packageAt(root, "1.0.0", pair, false));
    await installer.remove("sample-tool", true);
    expect(database.prepare("SELECT tool_id FROM tool_kv").all()).toEqual([]);
    expect(await readdir(join(root, "tool-data")).catch(() => [])).toEqual([]);
    database.close();
  });
  it("limpia todo lo temporal cuando falla la extracción", async () => {
    const root = await temp();
    const { database, pair } = setup(root, true);
    const broken = createToolInstaller({
      database,
      userData: root,
      trustedKeys: () => new Map([["test", pair.publicKeyPem]]),
      developerMode: () => true,
      hostVersion: "0.1.0",
      extract: async () => {
        throw new Error("extract failure");
      },
    });
    await expect(broken.install(await packageAt(root, "1.0.0", pair, false))).rejects.toThrow(
      "extract failure",
    );
    expect(await readdir(join(root, "tools"))).toEqual([]);
    database.close();
  });

  it("verifica y extrae la misma copia privada, y la elimina tras completar y confirmar downgrade", async () => {
    const root = await temp();
    const { database, pair } = setup(root, true);
    const original = await packageAt(root, "1.0.0", pair, false);
    const verified: string[] = [];
    const extracted: string[] = [];
    const installer = createToolInstaller({
      database,
      userData: root,
      trustedKeys: () => new Map([["test", pair.publicKeyPem]]),
      developerMode: () => true,
      hostVersion: "0.1.0",
      verify: async (file, options) => {
        verified.push(file);
        return verifyPackage(file, options);
      },
      extract: async (file, target) => {
        extracted.push(file);
        await extractPackage(file, target);
      },
    });
    await installer.install(original);
    expect(verified).toHaveLength(1);
    expect(extracted).toEqual(verified);
    const firstCopy = verified[0];
    if (!firstCopy) throw new Error("No se verificó la copia privada.");
    expect(firstCopy).not.toBe(original);
    expect(firstCopy).toContain(join(root, "tools", ".tmp-"));
    await expect(readFile(firstCopy)).rejects.toMatchObject({ code: "ENOENT" });

    const older = await packageAt(root, "0.9.0", pair, false);
    await expect(installer.install(older)).rejects.toMatchObject({ code: "E_DOWNGRADE_CONFIRM" });
    expect(installer.getPendingDowngrade()).toEqual({
      toolId: "sample-tool",
      installedVersion: "1.0.0",
      version: "0.9.0",
    });
    await installer.confirmDowngrade("sample-tool", "0.9.0");
    expect(verified).toHaveLength(3);
    expect(verified[1]).not.toBe(older);
    expect(verified[2]).not.toBe(older);
    expect(verified[2]).not.toBe(verified[1]);
    const pendingCopy = verified[1];
    const confirmedCopy = verified[2];
    if (!pendingCopy || !confirmedCopy) throw new Error("Falta una ruta temporal verificada.");
    await expect(readFile(pendingCopy)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(confirmedCopy)).rejects.toMatchObject({ code: "ENOENT" });
    database.close();
  });

  it("elimina la copia privada si falla verify o extract", async () => {
    const root = await temp();
    const { database, pair } = setup(root, true);
    const original = await packageAt(root, "1.0.0", pair, false);
    let verifyPath = "";
    const verifyFailure = createToolInstaller({
      database,
      userData: root,
      trustedKeys: () => new Map(),
      developerMode: () => true,
      hostVersion: "0.1.0",
      verify: async (file) => {
        verifyPath = file;
        return { ok: false, code: "E_UNSIGNED", message: "rejected" };
      },
    });
    await expect(verifyFailure.install(original)).rejects.toMatchObject({ code: "E_UNSIGNED" });
    expect(verifyPath).not.toBe(original);
    expect(verifyPath).toContain(join(root, "tools", ".tmp-"));
    await expect(readFile(verifyPath)).rejects.toMatchObject({ code: "ENOENT" });

    let extractPath = "";
    const extractFailure = createToolInstaller({
      database,
      userData: root,
      trustedKeys: () => new Map([["test", pair.publicKeyPem]]),
      developerMode: () => true,
      hostVersion: "0.1.0",
      extract: async (file) => {
        extractPath = file;
        throw new Error("extract rejected");
      },
    });
    await expect(extractFailure.install(original)).rejects.toThrow("extract rejected");
    expect(extractPath).not.toBe(original);
    expect(extractPath).toContain(join(root, "tools", ".tmp-"));
    await expect(readFile(extractPath)).rejects.toMatchObject({ code: "ENOENT" });
    database.close();
  });
});

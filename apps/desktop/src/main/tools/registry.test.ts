import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHostDatabase } from "../db/driver.ts";
import { scanDevTools } from "./dev-tools.ts";
import { createToolRegistry } from "./registry.ts";
import { loadTrustedKeys } from "./trusted-keys.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
describe("tool registry and local trust", () => {
  it("parametriza lecturas y escrituras, y limita la clave dev a developerMode", async () => {
    const root = await mkdtemp(join(tmpdir(), "lensdesk-registry-"));
    roots.push(root);
    const database = openHostDatabase(root);
    const registry = createToolRegistry(database);
    expect(registry.list()).toEqual([]);
    expect([...loadTrustedKeys({ directory: join(root, "absent"), developerMode: true })]).toEqual(
      [],
    );
    await mkdir(join(root, "keys"));
    await writeFile(join(root, "keys/dev.pub"), "dev-key");
    await writeFile(join(root, "keys/release.pub"), "release-key");
    expect([...loadTrustedKeys({ directory: join(root, "keys"), developerMode: false })]).toEqual([
      ["release", "release-key"],
    ]);
    expect([
      ...loadTrustedKeys({ directory: join(root, "keys"), developerMode: true }),
    ]).toHaveLength(2);
    database.close();
  });
  it("registra manifiestos válidos en dist/ o raíz solo en desarrollo, como no firmados", async () => {
    const root = await mkdtemp(join(tmpdir(), "lensdesk-devtools-"));
    roots.push(root);
    const database = openHostDatabase(root);
    const registry = createToolRegistry(database);
    const dev = join(root, "dev");
    await mkdir(join(dev, "one", "dist"), { recursive: true });
    await mkdir(join(dev, "two"), { recursive: true });
    const manifest = (id: string) =>
      JSON.stringify({
        id,
        name: { es: id, en: id },
        description: { es: "d", en: "d" },
        version: "1.0.0",
        apiVersion: 1,
        icon: "Box",
        ui: { entry: "ui/index.html" },
        permissions: [],
        minHostVersion: "0.1.0",
      });
    await writeFile(join(dev, "one/dist/lensdesk.tool.json"), manifest("one-tool"));
    await writeFile(join(dev, "two/lensdesk.tool.json"), manifest("two-tool"));
    await scanDevTools({ directory: dev, isPackaged: false, registry });
    expect(registry.list().map(({ id, signed, keyId }) => ({ id, signed, keyId }))).toEqual([
      { id: "one-tool", signed: false, keyId: null },
      { id: "two-tool", signed: false, keyId: null },
    ]);
    await scanDevTools({ directory: dev, isPackaged: true, registry });
    expect(registry.list()).toHaveLength(2);
    database.close();
  });
});

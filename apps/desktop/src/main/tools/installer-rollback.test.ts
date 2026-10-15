import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, packTool } from "@lensdesk/lenspkg";
import { afterEach, describe, expect, it } from "vitest";
import { openHostDatabase } from "../db/driver.ts";
import { createToolInstaller } from "./installer.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("installer rollback", () => {
  it("removes extracted files when the registry upsert fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "lensdesk-installer-rollback-"));
    roots.push(root);
    const source = join(root, "source");
    await mkdir(join(source, "ui"), { recursive: true });
    await writeFile(
      join(source, "lensdesk.tool.json"),
      JSON.stringify({
        id: "sample-tool",
        name: { es: "Muestra", en: "Sample" },
        description: { es: "Demo", en: "Demo" },
        version: "1.0.0",
        apiVersion: 1,
        icon: "Box",
        ui: { entry: "ui/index.html" },
        permissions: [],
        minHostVersion: "0.1.0",
      }),
    );
    await writeFile(join(source, "ui/index.html"), "ok");
    const pair = generateKeyPair();
    const packagePath = join(root, "sample.lenspkg");
    await packTool(source, { outFile: packagePath, signing: null });
    const database = openHostDatabase(root);
    const brokenDatabase = {
      exec: (sql: string) => database.exec(sql),
      close: () => database.close(),
      prepare(sql: string) {
        if (sql.startsWith("INSERT INTO installed_tools"))
          return {
            all: () => [],
            get: () => undefined,
            run: () => {
              throw new Error("upsert failure");
            },
          };
        return database.prepare(sql);
      },
    };
    const installer = createToolInstaller({
      database: brokenDatabase,
      userData: root,
      trustedKeys: () => new Map([["test", pair.publicKeyPem]]),
      developerMode: () => true,
      hostVersion: "0.1.0",
    });
    await expect(installer.install(packagePath)).rejects.toThrow("upsert failure");
    expect(await readdir(join(root, "tools"))).toEqual([]);
    database.close();
  });
});

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSetting, setSetting } from "../../apps/desktop/src/main/db/settings-repo.ts";
import type { UpdateHttpFetch } from "../../apps/desktop/src/main/updates/network.ts";
import { createUpdateService } from "../../apps/desktop/src/main/updates/update-service.ts";
import { prepareRecentUpdateProfile } from "../e2e/profile.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function profile() {
  const directory = await mkdtemp(join(tmpdir(), "lensdesk-profile-test-"));
  roots.push(directory);
  return directory;
}

describe("aislamiento de perfiles E2E frescos", () => {
  it("habilita updates y evita GET automático real, conservando la búsqueda manual", async () => {
    const directory = await profile();
    await prepareRecentUpdateProfile(directory);
    const database = new DatabaseSync(join(directory, "lensdesk.db"));
    try {
      expect(getSetting(database, "updates.check")).toBe(true);
      const last = getSetting(database, "updates.lastCheckedAt");
      expect(typeof last).toBe("string");
      expect(Date.now() - Date.parse(String(last))).toBeLessThan(60_000);
      const fetch = vi.fn<UpdateHttpFetch>(async (url) =>
        Response.json(
          url.startsWith("https://api.github.com/")
            ? {
                tag_name: "v0.4.0",
                html_url: "https://github.com/LensSystems/LensDesk/releases/tag/v0.4.0",
              }
            : {
                schemaVersion: 1,
                repository: "LensSystems/LensDesk",
                generatedAt: new Date().toISOString(),
                releases: [],
              },
        ),
      );
      const service = createUpdateService({
        repo: "LensSystems/LensDesk",
        currentVersion: "0.4.0",
        fetch,
        now: () => new Date(),
        settings: {
          enabled: () => getSetting(database, "updates.check") === true,
          lastCheckedAt: () => String(getSetting(database, "updates.lastCheckedAt")),
          setLastCheckedAt: (value) => setSetting(database, "updates.lastCheckedAt", value),
        },
        emit: vi.fn(),
        log: vi.fn(),
      });
      expect(await service.run()).toMatchObject({ kind: "skipped" });
      expect(fetch).not.toHaveBeenCalled();
      expect(await service.run(true)).toMatchObject({
        kind: "none",
        sources: { app: { status: "success" }, tools: { status: "success" } },
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      database.close();
    }
  });

  it.each(["custom", "future", "opaque"])(
    "preserva sin reescribir la base existente %s",
    async (kind) => {
      const directory = await profile();
      const file = join(directory, "lensdesk.db");
      if (kind === "opaque") await writeFile(file, "fixture que no es SQLite");
      else {
        const database = new DatabaseSync(file);
        database.exec("CREATE TABLE marker (value TEXT); INSERT INTO marker VALUES ('preservar');");
        if (kind === "future")
          database.exec(
            "CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT); INSERT INTO schema_migrations VALUES (99999, 'future', '2099-01-01');",
          );
        database.close();
      }
      const before = await readFile(file);
      await prepareRecentUpdateProfile(directory);
      expect(await readFile(file)).toEqual(before);
    },
  );

  it("permite preparar explícitamente y luego lanzar con el default sin recrear migraciones", async () => {
    const directory = await profile();
    await prepareRecentUpdateProfile(directory);
    const file = join(directory, "lensdesk.db");
    const before = await readFile(file);
    await prepareRecentUpdateProfile(directory);
    expect(await readFile(file)).toEqual(before);
  });
});

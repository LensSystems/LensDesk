import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHostDatabase } from "../db/driver.ts";
import { createTabsStore } from "./tabs-store.ts";

const directories: string[] = [];
function open() {
  const directory = mkdtempSync(join(tmpdir(), "lensdesk-tabs-"));
  directories.push(directory);
  return openHostDatabase(directory);
}
function insertTool(database: ReturnType<typeof openHostDatabase>, id: string) {
  database
    .prepare(
      "INSERT INTO installed_tools (id, version, manifest_json, install_path, signed, installed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, "1.0.0", "{}", `/tools/${id}`, 1, new Date().toISOString(), new Date().toISOString());
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("tabs store", () => {
  it("reuses an open tab and selects the neighbor when closing the active tab", () => {
    const database = open();
    insertTool(database, "one");
    insertTool(database, "two");
    const events: unknown[] = [];
    const store = createTabsStore(database, (tabs) => events.push(tabs));
    store.open("one");
    store.open("two");
    store.open("one");
    expect(database.prepare("SELECT COUNT(*) AS count FROM open_tabs").get()).toMatchObject({
      count: 2,
    });
    expect(store.close("one")).toEqual([{ toolId: "two", position: 0, active: true }]);
    expect(events).toHaveLength(4);
    database.close();
  });

  it("retains tab order and the active tab after reopening the database", () => {
    const directory = mkdtempSync(join(tmpdir(), "lensdesk-tabs-"));
    directories.push(directory);
    const database = openHostDatabase(directory);
    insertTool(database, "one");
    insertTool(database, "two");
    const store = createTabsStore(database, () => undefined);
    store.open("one");
    store.open("two");
    database.close();

    const reopened = openHostDatabase(directory);
    expect(createTabsStore(reopened, () => undefined).list()).toEqual([
      { toolId: "one", position: 0, active: false },
      { toolId: "two", position: 1, active: true },
    ]);
    reopened.close();
  });
});

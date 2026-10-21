import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openHostDatabase } from "../db/driver.ts";
import { createTabHandlers } from "./tab-handlers.ts";
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
  it("cierra la menos usada no activa y deshacer restaura su posición sin superar ocho", () => {
    const database = open();
    const store = createTabsStore(database, () => undefined);
    for (let index = 0; index < 9; index++) insertTool(database, `tool-${index}`);
    for (let index = 0; index < 8; index++) store.open(`tool-${index}`);
    store.activate("tool-0");
    store.activate("tool-2");
    const opened = store.open("tool-8");
    expect(opened).toHaveLength(8);
    expect(opened.some((tab) => tab.toolId === "tool-1")).toBe(false);
    expect(opened.some((tab) => tab.toolId === "tool-2")).toBe(true);
    const restored = store.undoClose("tool-1");
    expect(restored).toHaveLength(8);
    expect(restored[1]).toEqual({ toolId: "tool-1", position: 1, active: true });
    expect(restored.some((tab) => tab.toolId === "tool-3")).toBe(false);
    expect(restored.some((tab) => tab.toolId === "tool-8")).toBe(true);
    expect(() => store.undoClose("tool-1")).toThrow();
    database.close();
  });

  it("recorta a ocho una sesión guardada con más pestañas, conservando la activa", () => {
    const database = open();
    for (let index = 0; index < 12; index++) {
      insertTool(database, `tool-${index}`);
      database
        .prepare("INSERT INTO open_tabs (position, tool_id, active) VALUES (?, ?, ?)")
        .run(index, `tool-${index}`, index === 0 ? 1 : 0);
    }
    insertTool(database, "nueva");
    const store = createTabsStore(database, () => undefined);
    const tabs = store.list();
    expect(tabs).toHaveLength(8);
    expect(tabs[0]).toMatchObject({ toolId: "tool-0", active: true, position: 0 });
    expect(tabs.map((tab) => tab.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(store.open("nueva")).toHaveLength(8);
    database.close();
  });

  it("protege la activa aunque sea la más antigua al restaurar la sesión", () => {
    const database = open();
    const original = createTabsStore(database, () => undefined);
    for (let index = 0; index < 9; index++) insertTool(database, `tool-${index}`);
    for (let index = 0; index < 8; index++) original.open(`tool-${index}`);
    original.activate("tool-0");
    const restored = createTabsStore(database, () => undefined);
    const tabs = restored.open("tool-8");
    expect(tabs).toHaveLength(8);
    expect(tabs.some((tab) => tab.toolId === "tool-0")).toBe(true);
    expect(tabs.some((tab) => tab.toolId === "tool-1")).toBe(false);
    database.close();
  });

  it("libera los procesos al cerrar automáticamente y al deshacer, sin avisar del cierre manual", () => {
    const database = open();
    const store = createTabsStore(database, () => undefined);
    const closeTool = vi.fn();
    const notifyClosed = vi.fn();
    const handlers = createTabHandlers({
      tabsStore: () => store,
      closeTool,
      notifyClosed,
      follow: vi.fn(),
      hideAll: vi.fn(),
      leaveTab: vi.fn(),
    });
    for (let index = 0; index < 9; index++) insertTool(database, `tool-${index}`);
    for (let index = 0; index < 9; index++) handlers["tabs.open"]({ toolId: `tool-${index}` });
    expect(closeTool).toHaveBeenCalledExactlyOnceWith("tool-0");
    expect(notifyClosed).toHaveBeenCalledExactlyOnceWith("tool-0");
    handlers["tabs.undoClose"]({ toolId: "tool-0" });
    expect(closeTool).toHaveBeenLastCalledWith("tool-1");
    expect(notifyClosed).toHaveBeenLastCalledWith("tool-1");
    expect(store.list()[0]).toMatchObject({ toolId: "tool-0", active: true });
    expect(store.list()).toHaveLength(8);
    handlers["tabs.close"]({ toolId: "tool-0" });
    expect(closeTool).toHaveBeenLastCalledWith("tool-0");
    expect(notifyClosed).toHaveBeenCalledTimes(2);
    database.close();
  });

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

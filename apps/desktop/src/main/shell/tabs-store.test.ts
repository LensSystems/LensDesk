import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_OPEN_TABS } from "../../shared/layout.ts";
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
  it("revierte todas las posiciones si falla una actualización", () => {
    const database = open();
    const emit = vi.fn();
    const store = createTabsStore(database, emit);
    for (const id of ["one", "two"]) {
      insertTool(database, id);
      store.open(id);
    }
    const before = store.list();
    emit.mockClear();
    database.exec(`CREATE TRIGGER fail_move BEFORE UPDATE OF position ON open_tabs
      WHEN NEW.tool_id = 'one' AND NEW.position = 1
      BEGIN SELECT RAISE(ABORT, 'move failed'); END`);
    expect(() => store.move("two", 0)).toThrow("move failed");
    expect(store.list()).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
    database.close();
  });

  it("el handler publica el nuevo orden sin mover la vista ni cerrar herramientas", () => {
    const database = open();
    const emit = vi.fn();
    const store = createTabsStore(database, emit);
    for (const id of ["one", "two"]) {
      insertTool(database, id);
      store.open(id);
    }
    emit.mockClear();
    const follow = vi.fn();
    const closeTool = vi.fn();
    const handlers = createTabHandlers({
      tabsStore: () => store,
      follow,
      closeTool,
      notifyClosed: vi.fn(),
      hideAll: vi.fn(),
      leaveTab: vi.fn(),
    });
    const result = handlers["tabs.move"]({ toolId: "two", toIndex: 0 });
    expect(result.tabs.map((tab) => tab.toolId)).toEqual(["two", "one"]);
    expect(emit).toHaveBeenCalledExactlyOnceWith(result.tabs);
    expect(follow).not.toHaveBeenCalled();
    expect(closeTool).not.toHaveBeenCalled();
    database.close();
  });

  it("mueve al inicio, al final y a sí misma, publica y conserva la activa", () => {
    const database = open();
    const emit = vi.fn();
    const store = createTabsStore(database, emit);
    for (const id of ["one", "two", "three"]) {
      insertTool(database, id);
      store.open(id);
    }
    emit.mockClear();
    expect(store.move("three", 0).map((tab) => tab.toolId)).toEqual(["three", "one", "two"]);
    const moved = store.move("three", 2);
    expect(moved).toEqual([
      { toolId: "one", position: 0, active: false },
      { toolId: "two", position: 1, active: false },
      { toolId: "three", position: 2, active: true },
    ]);
    expect(store.move("two", 1)).toEqual(moved);
    expect(createTabsStore(database, () => undefined).list()).toEqual(moved);
    // Mover a su misma posición no publica.
    expect(emit).toHaveBeenCalledTimes(2);
    database.close();
  });

  it("rechaza índices fuera de rango sin cambiar ni publicar el orden", () => {
    const database = open();
    insertTool(database, "one");
    const emit = vi.fn();
    const store = createTabsStore(database, emit);
    const before = store.open("one");
    emit.mockClear();
    for (const index of [-1, 1, 0.5, Number.NaN]) {
      expect(() => store.move("one", index)).toThrow(
        expect.objectContaining({ code: "E_INVALID_PARAMS" }),
      );
    }
    expect(store.list()).toEqual(before);
    expect(emit).not.toHaveBeenCalled();
    database.close();
  });

  it("cierra la menos usada no activa y deshacer restaura su posición sin superar el límite", () => {
    const database = open();
    const store = createTabsStore(database, () => undefined);
    for (let index = 0; index < MAX_OPEN_TABS + 1; index++) insertTool(database, `tool-${index}`);
    for (let index = 0; index < MAX_OPEN_TABS; index++) store.open(`tool-${index}`);
    store.activate("tool-0");
    store.activate("tool-2");
    const opened = store.open(`tool-${MAX_OPEN_TABS}`);
    expect(opened).toHaveLength(MAX_OPEN_TABS);
    expect(opened.some((tab) => tab.toolId === "tool-1")).toBe(false);
    expect(opened.some((tab) => tab.toolId === "tool-2")).toBe(true);
    const restored = store.undoClose("tool-1");
    expect(restored).toHaveLength(MAX_OPEN_TABS);
    expect(restored[1]).toEqual({ toolId: "tool-1", position: 1, active: true });
    expect(restored.some((tab) => tab.toolId === "tool-3")).toBe(false);
    expect(restored.some((tab) => tab.toolId === `tool-${MAX_OPEN_TABS}`)).toBe(true);
    expect(() => store.undoClose("tool-1")).toThrow();
    database.close();
  });

  it("recorta al límite una sesión guardada con más pestañas, conservando la activa", () => {
    const database = open();
    for (let index = 0; index < MAX_OPEN_TABS + 4; index++) {
      insertTool(database, `tool-${index}`);
      database
        .prepare("INSERT INTO open_tabs (position, tool_id, active) VALUES (?, ?, ?)")
        .run(index, `tool-${index}`, index === 0 ? 1 : 0);
    }
    insertTool(database, "nueva");
    const store = createTabsStore(database, () => undefined);
    const tabs = store.list();
    expect(tabs).toHaveLength(MAX_OPEN_TABS);
    expect(tabs[0]).toMatchObject({ toolId: "tool-0", active: true, position: 0 });
    expect(tabs.map((tab) => tab.position)).toEqual(
      Array.from({ length: MAX_OPEN_TABS }, (_, index) => index),
    );
    expect(store.open("nueva")).toHaveLength(MAX_OPEN_TABS);
    database.close();
  });

  it("protege la activa aunque sea la más antigua al restaurar la sesión", () => {
    const database = open();
    const original = createTabsStore(database, () => undefined);
    for (let index = 0; index < MAX_OPEN_TABS + 1; index++) insertTool(database, `tool-${index}`);
    for (let index = 0; index < MAX_OPEN_TABS; index++) original.open(`tool-${index}`);
    original.activate("tool-0");
    const restored = createTabsStore(database, () => undefined);
    const tabs = restored.open(`tool-${MAX_OPEN_TABS}`);
    expect(tabs).toHaveLength(MAX_OPEN_TABS);
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
    for (let index = 0; index < MAX_OPEN_TABS + 1; index++) insertTool(database, `tool-${index}`);
    for (let index = 0; index < MAX_OPEN_TABS + 1; index++)
      handlers["tabs.open"]({ toolId: `tool-${index}` });
    expect(closeTool).toHaveBeenCalledExactlyOnceWith("tool-0");
    expect(notifyClosed).toHaveBeenCalledExactlyOnceWith("tool-0", `tool-${MAX_OPEN_TABS}`);
    handlers["tabs.undoClose"]({ toolId: "tool-0" });
    expect(closeTool).toHaveBeenLastCalledWith("tool-1");
    expect(notifyClosed).toHaveBeenLastCalledWith("tool-1", "tool-0");
    expect(store.list()[0]).toMatchObject({ toolId: "tool-0", active: true });
    expect(store.list()).toHaveLength(MAX_OPEN_TABS);
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
    store.move("two", 0);
    database.close();

    const reopened = openHostDatabase(directory);
    expect(createTabsStore(reopened, () => undefined).list()).toEqual([
      { toolId: "two", position: 0, active: true },
      { toolId: "one", position: 1, active: false },
    ]);
    reopened.close();
  });
});

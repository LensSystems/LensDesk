import { LensError } from "@lensdesk/sdk/errors";
import type { ShellTab } from "../../shared/host-channels.ts";
import { MAX_OPEN_TABS } from "../../shared/layout.ts";
import type { SqliteDatabase } from "../db/database.ts";

type TabRow = { tool_id: string; position: number; active: number };
const readTabs = (database: SqliteDatabase): ShellTab[] =>
  (
    database
      .prepare("SELECT tool_id, position, active FROM open_tabs ORDER BY position")
      .all() as TabRow[]
  ).map((row) => ({
    toolId: row.tool_id,
    position: row.position,
    active: row.active === 1,
  }));

export function createTabsStore(database: SqliteDatabase, emit: (tabs: ShellTab[]) => void) {
  let clock = 0;
  const lastUsed = new Map<string, number>();
  const closedTabs = new Map<string, ShellTab>();
  const activateRow = (toolId: string): void => {
    lastUsed.set(toolId, ++clock);
    database.prepare("UPDATE open_tabs SET active = 0 WHERE active = 1").run();
    database.prepare("UPDATE open_tabs SET active = 1 WHERE tool_id = ?").run(toolId);
  };
  const list = (): ShellTab[] => readTabs(database);
  const transaction = (work: () => void): void => {
    database.exec("BEGIN");
    try {
      work();
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  };
  const publish = (): ShellTab[] => {
    const tabs = list();
    emit(tabs);
    return tabs;
  };
  // Las no activas que llevan más tiempo sin usarse (las restauradas de otra sesión, por orden).
  const leastUsed = (tabs: ShellTab[], count: number): ShellTab[] =>
    tabs
      .filter((tab) => !tab.active)
      .sort((a, b) => (lastUsed.get(a.toolId) ?? 0) - (lastUsed.get(b.toolId) ?? 0))
      .slice(0, Math.max(0, count));
  const renumber = (): void => {
    database.prepare("UPDATE open_tabs SET position = position + 1000000").run();
    list().forEach((tab, index) => {
      database
        .prepare("UPDATE open_tabs SET position = ? WHERE tool_id = ?")
        .run(index, tab.toolId);
    });
  };
  // Una sesión guardada puede superar el límite actual de pestañas.
  const saved = list();
  if (saved.length > MAX_OPEN_TABS) {
    const extra = leastUsed(saved, saved.length - MAX_OPEN_TABS);
    transaction(() => {
      for (const tab of extra)
        database.prepare("DELETE FROM open_tabs WHERE tool_id = ?").run(tab.toolId);
      renumber();
    });
  }
  const store = {
    list,
    undoClose(toolId: string): ShellTab[] {
      const closed = closedTabs.get(toolId);
      if (!closed) throw new LensError("E_TOOL_NOT_FOUND", "La pestaña ya no se puede restaurar.");
      const position = closed.position;
      return store.open(toolId, position);
    },
    open(toolId: string, position?: number): ShellTab[] {
      const existing = database
        .prepare("SELECT tool_id FROM open_tabs WHERE tool_id = ?")
        .get(toolId);
      if (!existing) {
        const installed = database
          .prepare("SELECT id FROM installed_tools WHERE id = ? AND enabled = 1")
          .get(toolId);
        if (!installed)
          throw new LensError("E_TOOL_NOT_FOUND", "La herramienta no está disponible.");
        const tabs = list();
        const evicted = leastUsed(tabs, tabs.length - MAX_OPEN_TABS + 1);
        transaction(() => {
          for (const tab of evicted)
            database.prepare("DELETE FROM open_tabs WHERE tool_id = ?").run(tab.toolId);
          const remaining = list();
          const insertion = Math.min(position ?? remaining.length, remaining.length);
          database.prepare("UPDATE open_tabs SET position = position + 1000000").run();
          remaining.forEach((tab, index) => {
            database
              .prepare("UPDATE open_tabs SET position = ? WHERE tool_id = ?")
              .run(index >= insertion ? index + 1 : index, tab.toolId);
          });
          database
            .prepare("INSERT INTO open_tabs (position, tool_id, active) VALUES (?, ?, 0)")
            .run(insertion, toolId);
          activateRow(toolId);
        });
        closedTabs.delete(toolId);
        for (const tab of evicted) {
          closedTabs.set(tab.toolId, tab);
          lastUsed.delete(tab.toolId);
        }
      } else {
        transaction(() => activateRow(toolId));
      }
      return publish();
    },
    move(toolId: string, toIndex: number): ShellTab[] {
      const tabs = list();
      if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= tabs.length)
        throw new LensError("E_INVALID_PARAMS", "La posición de pestaña no es válida.");
      const fromIndex = tabs.findIndex((tab) => tab.toolId === toolId);
      if (fromIndex < 0) throw new LensError("E_TOOL_NOT_FOUND", "La pestaña no está abierta.");
      // Soltar en el mismo sitio no cambia nada ni publica un evento.
      if (fromIndex === toIndex) return tabs;
      const [tab] = tabs.splice(fromIndex, 1);
      if (tab) tabs.splice(toIndex, 0, tab);
      transaction(() => {
        database.prepare("UPDATE open_tabs SET position = position + 1000000").run();
        tabs.forEach((current, position) => {
          database
            .prepare("UPDATE open_tabs SET position = ? WHERE tool_id = ?")
            .run(position, current.toolId);
        });
      });
      return publish();
    },
    activate(toolId: string): ShellTab[] {
      if (!database.prepare("SELECT tool_id FROM open_tabs WHERE tool_id = ?").get(toolId))
        throw new LensError("E_TOOL_NOT_FOUND", "La pestaña no está abierta.");
      transaction(() => activateRow(toolId));
      return publish();
    },
    close(toolId: string): ShellTab[] {
      const tabs = list();
      const index = tabs.findIndex((tab) => tab.toolId === toolId);
      if (index < 0) throw new LensError("E_TOOL_NOT_FOUND", "La pestaña no está abierta.");
      const wasActive = tabs[index]?.active === true;
      transaction(() => {
        database.prepare("DELETE FROM open_tabs WHERE tool_id = ?").run(toolId);
        const remaining = list();
        database.prepare("UPDATE open_tabs SET position = position + 1000000").run();
        remaining.forEach((tab, position) => {
          database
            .prepare("UPDATE open_tabs SET position = ? WHERE tool_id = ?")
            .run(position, tab.toolId);
        });
        const neighbor = remaining[Math.min(index, remaining.length - 1)];
        if (wasActive && neighbor) activateRow(neighbor.toolId);
      });
      lastUsed.delete(toolId);
      return publish();
    },
  };
  return store;
}

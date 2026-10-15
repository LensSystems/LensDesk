import { LensError } from "@lensdesk/sdk/errors";
import type { ShellTab } from "../../shared/host-channels.ts";
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
  const activateRow = (toolId: string): void => {
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
  return {
    list,
    open(toolId: string): ShellTab[] {
      const existing = database
        .prepare("SELECT tool_id FROM open_tabs WHERE tool_id = ?")
        .get(toolId);
      if (!existing) {
        const installed = database
          .prepare("SELECT id FROM installed_tools WHERE id = ? AND enabled = 1")
          .get(toolId);
        if (!installed)
          throw new LensError("E_TOOL_NOT_FOUND", "La herramienta no está disponible.");
        transaction(() => {
          database
            .prepare("INSERT INTO open_tabs (position, tool_id, active) VALUES (?, ?, 0)")
            .run(list().length, toolId);
          activateRow(toolId);
        });
      } else {
        transaction(() => activateRow(toolId));
      }
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
      return publish();
    },
  };
}

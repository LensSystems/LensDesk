import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openHostDatabase } from "../db/driver.ts";
import { restoreWindowBounds, saveWindowBounds } from "./window-state.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("window state", () => {
  it("restores saved bounds within a visible display", () => {
    const directory = mkdtempSync(join(tmpdir(), "lensdesk-window-"));
    directories.push(directory);
    const database = openHostDatabase(directory);
    saveWindowBounds(database, { x: 3000, y: 3000, width: 900, height: 600 });
    expect(restoreWindowBounds(database, [{ x: 0, y: 0, width: 1280, height: 800 }])).toEqual({
      x: 380,
      y: 200,
      width: 900,
      height: 600,
    });
    database.close();
  });

  it("centra la ventana en la primera pantalla cuando no hay límites guardados", () => {
    const directory = mkdtempSync(join(tmpdir(), "lensdesk-window-"));
    directories.push(directory);
    const database = openHostDatabase(directory);
    expect(restoreWindowBounds(database, [{ x: 0, y: 0, width: 1920, height: 1080 }])).toEqual({
      x: 410,
      y: 180,
      width: 1100,
      height: 720,
    });
    database.close();
  });
});

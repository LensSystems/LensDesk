import { MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH } from "../../shared/layout.ts";
import type { SqliteDatabase } from "../db/database.ts";
import { getSetting, setSetting } from "../db/settings-repo.ts";

export type WindowBounds = { x: number; y: number; width: number; height: number };
export type DisplayBounds = { x: number; y: number; width: number; height: number };
const defaultSize = { width: 1100, height: 720 };

export function saveWindowBounds(database: SqliteDatabase, bounds: WindowBounds): void {
  setSetting(database, "window.bounds", bounds);
}

export function restoreWindowBounds(
  database: SqliteDatabase,
  displays: DisplayBounds[],
): WindowBounds {
  const primary = displays[0];
  if (!primary) return { x: 0, y: 0, ...defaultSize };
  const saved = getSetting(database, "window.bounds") ?? {
    x: primary.x + Math.round((primary.width - defaultSize.width) / 2),
    y: primary.y + Math.round((primary.height - defaultSize.height) / 2),
    ...defaultSize,
  };
  const display =
    displays.find(
      (screen) =>
        saved.x < screen.x + screen.width &&
        saved.x + saved.width > screen.x &&
        saved.y < screen.y + screen.height &&
        saved.y + saved.height > screen.y,
    ) ?? primary;
  // El mínimo nunca supera el área de trabajo: en pantallas pequeñas la ventana cabe entera.
  const width = Math.min(display.width, Math.max(MIN_WINDOW_WIDTH, saved.width));
  const height = Math.min(display.height, Math.max(MIN_WINDOW_HEIGHT, saved.height));
  return {
    x: Math.max(display.x, Math.min(saved.x, display.x + display.width - width)),
    y: Math.max(display.y, Math.min(saved.y, display.y + display.height - height)),
    width,
    height,
  };
}

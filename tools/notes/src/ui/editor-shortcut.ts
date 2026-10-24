import type { TFunction } from "i18next";

export function editorShortcut(t: TFunction, action: string) {
  const mac = /Mac/.test(navigator.platform);
  return t(`shortcuts.${mac ? "mac" : "other"}.${action}`);
}

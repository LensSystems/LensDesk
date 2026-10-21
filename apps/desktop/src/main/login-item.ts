import { LensError } from "@lensdesk/sdk/errors";
import { z } from "zod";

export type LoginItemDependencies = {
  isPackaged: boolean;
  // En Windows `executableWillLaunchAtLogin` es falso si el usuario lo desactivó desde el sistema
  // aunque la entrada siga registrada.
  getLoginItemSettings(): { openAtLogin: boolean; executableWillLaunchAtLogin?: boolean };
  setLoginItemSettings(settings: { openAtLogin: boolean }): void;
};

export function createLoginItem(deps: LoginItemDependencies) {
  const read = () => {
    if (!deps.isPackaged) return false;
    const current = deps.getLoginItemSettings();
    return current.executableWillLaunchAtLogin ?? current.openAtLogin;
  };
  return {
    read,
    // Devuelve el estado que el sistema confirma tras escribir (puede no aplicarse sin firma).
    write: (value: unknown): boolean => {
      const result = z.boolean().safeParse(value);
      if (!result.success) throw new LensError("E_INVALID_PARAMS", "Valor no válido.");
      if (!deps.isPackaged) throw new LensError("E_PERMISSION_DENIED", "App no instalada.");
      deps.setLoginItemSettings({ openAtLogin: result.data });
      return read();
    },
  };
}

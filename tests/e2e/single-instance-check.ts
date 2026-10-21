import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect } from "@playwright/test";

export async function checkSingleInstance(executablePath: string, args: string[]): Promise<void> {
  const userDataDir = await mkdtemp(join(tmpdir(), "lensdesk-single-instance-"));
  const env: Record<string, string> = { LENSDESK_USER_DATA: userDataDir };
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE" && key !== "LENSDESK_USER_DATA")
      env[key] = value;
  const first = await electron.launch({ executablePath, args, env });
  try {
    const page = await first.firstWindow();
    await page.getByRole("button", { name: "Herramientas" }).waitFor();
    await first.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window) throw new Error("No existe la ventana principal");
      window.minimize();
    });
    await expect
      .poll(() =>
        first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized()),
      )
      .toBe(true);
    const second = spawn(executablePath, args, { env, stdio: "ignore" });
    try {
      const exit = await new Promise<{ code: number | null; signal: string | null }>(
        (resolveExit, reject) => {
          const timer = setTimeout(
            () => reject(new Error("La segunda instancia no terminó")),
            15_000,
          );
          second.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          second.once("exit", (code, signal) => {
            clearTimeout(timer);
            resolveExit({ code, signal });
          });
        },
      );
      expect(exit).toEqual({ code: 0, signal: null });
      await expect
        .poll(() =>
          first.evaluate(({ BrowserWindow }) => {
            const windows = BrowserWindow.getAllWindows();
            const window = windows[0];
            return {
              count: windows.length,
              minimized: window?.isMinimized(),
              // El foco no se comprueba: macOS no lo da si el usuario está en otra app. La
              // llamada a focus() la cubre single-instance.test.ts.
              visible: window?.isVisible(),
            };
          }),
        )
        .toEqual({ count: 1, minimized: false, visible: true });
      expect(first.process().exitCode).toBeNull();
    } finally {
      if (second.exitCode === null && second.signalCode === null) second.kill();
    }
  } finally {
    await first.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type ElectronApplication, _electron as electron, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const desktopPath = resolve(import.meta.dirname, "../../apps/desktop");
export async function launchApp(
  options: { userDataDir?: string } = {},
): Promise<ElectronApplication> {
  const userDataDir = options.userDataDir ?? (await mkdtemp(join(tmpdir(), "lensdesk-e2e-")));
  return electron.launch({
    executablePath: require("electron") as string,
    args: [desktopPath],
    env: { ...process.env, LENSDESK_USER_DATA: userDataDir },
  });
}

export async function stubDialog(
  app: ElectronApplication,
  kind: "open" | "save",
  result: unknown,
): Promise<void> {
  await app.evaluate(
    ({ dialog }, args) => {
      const target = args.kind === "open" ? "showOpenDialog" : "showSaveDialog";
      Object.defineProperty(dialog, target, { configurable: true, value: async () => args.result });
    },
    { kind, result },
  );
}

export async function toolPage(app: ElectronApplication, toolId: string): Promise<Page> {
  const expected = `lenstool://${toolId}/`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const pages = [...app.windows(), ...app.context().pages()];
    const found = pages.find((page) => page.url().startsWith(expected));
    if (found) return found;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`No se abrió la vista de la herramienta ${toolId}`);
}

export async function enableDeveloperMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Ajustes" }).click();
  const toggle = page.getByRole("switch", { name: "Modo desarrollador" });
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
}

export async function installTool(
  app: ElectronApplication,
  page: Page,
  lenspkgPath: string,
): Promise<void> {
  await stubDialog(app, "open", { canceled: false, filePaths: [lenspkgPath] });
  await page.getByRole("button", { name: "Herramientas" }).click();
  await page.getByRole("button", { name: "Agregar herramienta…" }).click();
  await page.getByText("Plantilla", { exact: true }).waitFor();
}

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { webFixture } from "../../tools/ventas/src/backend/web-backup-fixture.ts";
import type { NativeBackup } from "../../tools/ventas/src/shared/backup-contracts.ts";
import type { Action, Snapshot } from "../../tools/ventas/src/shared/contracts.ts";
import {
  enableDeveloperMode,
  installTool,
  launchApp,
  lenspkgPath,
  shellPage,
  stubDialog,
  toolPage,
} from "./helpers.ts";

async function query(tool: Page, method: string, params: unknown = {}) {
  const result = await tool.evaluate(
    async ({ method, params }) =>
      window.lensdesk.backend.invoke(crypto.randomUUID(), method, params),
    { method, params },
  );
  if (!result.ok) throw Error(result.error.code);
  const domain = result.data as { kind: string; value: unknown; issue?: { code: string } };
  if (domain.kind !== "ok") throw Error(JSON.stringify(domain));
  return domain.value;
}
const state = async (tool: Page) => (await query(tool, "snapshot")) as Snapshot;
async function execute(tool: Page, action: Action) {
  const revision = (await state(tool)).revision;
  return (
    (await query(tool, "execute", { key: crypto.randomUUID(), revision, action })) as { id: string }
  ).id;
}
async function restoreFile(app: Awaited<ReturnType<typeof launchApp>>, tool: Page, path: string) {
  await stubDialog(app, "open", { canceled: false, filePaths: [path] });
  await tool.getByRole("button", { name: "Seleccionar archivo de respaldo", exact: true }).click();
  await expect(tool.getByText(basename(path), { exact: true })).toBeVisible();
  await tool.getByRole("button", { name: "Recuperar respaldo", exact: true }).click();
  const dialog = tool.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reemplazar datos actuales", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(tool.getByText("Restauración confirmada.", { exact: true })).toBeVisible();
}
test("Ventas exporta y restaura archivos reales, copia previa y recibos tras reinicio", async () => {
  const profile = await mkdtemp(join(tmpdir(), "ventas-backup-e2e-")),
    path = join(profile, "completo.json"),
    prior = join(profile, "anterior.json");
  let app = await launchApp({ userDataDir: profile });
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("ventas"), "Ventas");
    await shell.getByRole("button", { name: "Abrir Ventas", exact: true }).click();
    let tool = await toolPage(app, "ventas");
    await execute(tool, {
      type: "saveSettings",
      settings: { name: "Antes", address: "Calle", phone: "", thanks: "Gracias", banks: [] },
    });
    await execute(tool, { type: "openCash", initial: 1000 });
    const pid = await execute(tool, {
      type: "saveProduct",
      product: {
        name: "Gomitas",
        category: "Dulces",
        kind: "simple",
        unit: "piece",
        price: 200,
        minStock: 0,
      },
    });
    await execute(tool, {
      type: "receive",
      productId: pid,
      qty: 3,
      cost: 100,
      method: "cash",
      bankId: null,
    });
    const cid = await execute(tool, {
      type: "saveClient",
      client: { name: "Cliente", phone: "", term: 15, limit: null },
    });
    await execute(tool, {
      type: "saveDraft",
      draft: { clientId: cid, lines: [{ productId: pid, qty: 1 }] },
    });
    await execute(tool, {
      type: "sell",
      expectedTotal: 200,
      payment: { amount: 100, received: 100, method: "cash", bankId: null, reference: "REF" },
      exception: "",
    });
    await tool.reload();
    await tool
      .getByRole("navigation")
      .getByRole("button", { name: "Ajustes de Ventas", exact: true })
      .click();
    await stubDialog(app, "save", { canceled: true });
    await tool.getByRole("button", { name: "Guardar respaldo", exact: true }).click();
    await expect(tool.getByRole("button", { name: "Guardar respaldo", exact: true })).toBeEnabled();
    await stubDialog(app, "save", { canceled: false, filePath: path });
    await tool.getByRole("button", { name: "Guardar respaldo", exact: true }).click();
    await expect(tool.getByText("Respaldo guardado.", { exact: true })).toBeVisible();
    const exported = JSON.parse(await readFile(path, "utf8")) as NativeBackup;
    expect(exported.data.sales).toHaveLength(1);
    expect(exported.data.operations.length).toBeGreaterThan(0);
    await execute(tool, {
      type: "saveSettings",
      settings: { name: "Después", address: "Otra", phone: "", thanks: "", banks: [] },
    });
    await execute(tool, {
      type: "outflow",
      kind: "expense",
      concept: "Ruta",
      category: "Otros",
      payment: { amount: 20, received: 20, method: "cash", bankId: null, reference: "GASTO" },
    });
    await execute(tool, {
      type: "saveDraft",
      draft: { clientId: cid, lines: [{ productId: pid, qty: 1 }] },
    });
    await tool.reload();
    await tool
      .getByRole("navigation")
      .getByRole("button", { name: "Ajustes de Ventas", exact: true })
      .click();
    await restoreFile(app, tool, path);
    expect(await state(tool)).toMatchObject({
      settings: { name: "Antes" },
      cash: { expected: 1000 },
      draft: { lines: [] },
      accounts: [{ balance: 100 }],
    });
    await expect(tool.getByLabel("Nombre del negocio", { exact: true })).toHaveValue("Antes");
    await stubDialog(app, "save", { canceled: false, filePath: prior });
    await tool.getByRole("button", { name: "Descargar copia previa", exact: true }).click();
    await expect(tool.getByText("Respaldo guardado.", { exact: true })).toBeVisible();
    await expect
      .poll(async () => JSON.parse(await readFile(prior, "utf8")).data.settings[0].data)
      .toBe(JSON.stringify({ name: "Después", address: "Otra", phone: "", thanks: "", banks: [] }));
    const previous = JSON.parse(await readFile(prior, "utf8")) as NativeBackup;
    expect(previous.data.outflows).toHaveLength(1);
    expect(previous.data.draft_lines).toHaveLength(1);
    // A real read token cannot be used for writing by the backend.
    await stubDialog(app, "open", { canceled: false, filePaths: [path] });
    const picked = await tool.evaluate(() => window.lensdesk.files.pickOpen({ multiple: false }));
    if (!picked.ok || !picked.data[0]) throw Error("No token");
    const denied = await tool.evaluate(
      async (token) =>
        window.lensdesk.backend.invoke(crypto.randomUUID(), "backupExport", { token }),
      picked.data[0].token,
    );
    expect(denied).toMatchObject({ ok: false, error: { code: "E_PATH_NOT_GRANTED" } });
    // Tokens issued to a different real tool remain foreign to Ventas.
    await installTool(app, shell, lenspkgPath("_template"), "Plantilla");
    await shell.getByRole("button", { name: "Abrir Plantilla", exact: true }).click();
    const other = await toolPage(app, "template");
    await stubDialog(app, "open", { canceled: false, filePaths: [path] });
    const foreign = await other.evaluate(() => window.lensdesk.files.pickOpen({ multiple: false }));
    if (!foreign.ok || !foreign.data[0]) throw Error("No foreign token");
    const rejected = await tool.evaluate(
      async (token) =>
        window.lensdesk.backend.invoke(crypto.randomUUID(), "backupPrepare", {
          token,
          name: "foreign.json",
        }),
      foreign.data[0].token,
    );
    expect(rejected).toMatchObject({ ok: false, error: { code: "E_PATH_NOT_GRANTED" } });
    await app.close();
    app = await launchApp({ userDataDir: profile });
    const reopenedShell = await shellPage(app);
    await reopenedShell.getByRole("tab", { name: /Ventas/ }).click();
    tool = await toolPage(app, "ventas");
    expect((await state(tool)).accounts[0]?.balance).toBe(100);
    expect(await query(tool, "backupInfo")).toMatchObject({ previous: true });
  } finally {
    await app.close().catch(() => undefined);
    await rm(profile, { recursive: true, force: true });
  }
});
test("Ventas importa Web1 real con folios históricos y limitaciones explícitas", async () => {
  const profile = await mkdtemp(join(tmpdir(), "ventas-web-e2e-")),
    path = join(profile, "web1.json");
  await writeFile(path, JSON.stringify(webFixture()));
  const app = await launchApp({ userDataDir: profile });
  try {
    const shell = await shellPage(app);
    await enableDeveloperMode(shell);
    await installTool(app, shell, lenspkgPath("ventas"), "Ventas");
    await shell.getByRole("button", { name: "Abrir Ventas", exact: true }).click();
    const tool = await toolPage(app, "ventas");
    await tool
      .getByRole("navigation")
      .getByRole("button", { name: "Ajustes de Ventas", exact: true })
      .click();
    await restoreFile(app, tool, path);
    expect(await state(tool)).toMatchObject({
      settings: { name: "Tienda web" },
      cash: { expected: 900 },
      accounts: [{ balance: 800 }],
    });
    await tool
      .getByRole("navigation")
      .getByRole("button", { name: "Tickets", exact: true })
      .click();
    await tool.getByRole("button", { name: /VENTA-arbitraria/ }).click();
    const ticket = tool.getByRole("article", { name: "Ticket de venta", exact: true });
    await expect(ticket.getByText("Gomitas históricas", { exact: true })).toBeVisible();
    await expect(
      ticket.getByText("Los datos del cobro inicial no están disponibles en este registro.", {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await app.close().catch(() => undefined);
    await rm(profile, { recursive: true, force: true });
  }
});

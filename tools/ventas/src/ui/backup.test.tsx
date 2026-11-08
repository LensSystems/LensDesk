import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, expect, it } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { type PreparedBackup, restoreInputSchema } from "../shared/backup-contracts.ts";
import { BackupPreview } from "./BackupPreview.tsx";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    interpolation: { escapeValue: false },
  });
});
beforeEach(async () => {
  await i18n.changeLanguage("es");
});
const preview: PreparedBackup = {
  id: crypto.randomUUID(),
  hash: "a".repeat(64),
  revision: 0,
  name: "web.json",
  format: "web1",
  createdAt: "2026-11-07T18:00:00Z",
  counts: { products: 2, clients: 1, sales: 3, payments: 2, returns: 1, cash_sessions: 1 },
  balance: "100",
  stockValue: "200",
  limitations: ["initialPayment", "business"],
};
async function open(f: ReturnType<typeof fixture>) {
  f.files.pickOpen.mockResolvedValue([{ token: "opaque", name: "web.json", size: 1 }]);
  f.mount();
  await screen.findByText(es.emptyCatalog);
  fireEvent.click(
    within(screen.getByRole("navigation")).getByRole("button", { name: es.nav.settings }),
  );
  fireEvent.click(screen.getByRole("button", { name: es.chooseBackup }));
  await screen.findByText("web.json");
  const trigger = screen.getByRole("button", { name: es.restoreBackup });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  await waitFor(() =>
    expect(within(dialog).getByRole("heading", { name: es.restoreBackup })).toHaveFocus(),
  );
  return { dialog, trigger };
}
it("projects strict restoration parameters and only reloads after confirmed restore with failed snapshot", async () => {
  const f = fixture(),
    base = f.invoke.getMockImplementation();
  if (!base) throw Error("Missing fixture");
  let confirmCount = 0,
    failSnapshot = false;
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "backupPrepare") return { kind: "ok", value: preview };
    if (method === "confirmRestore") {
      const p = restoreInputSchema.parse(params);
      expect(Object.keys(p).sort()).toEqual(["hash", "id", "key", "revision"]);
      confirmCount++;
      f.data.revision = 1;
      f.data.settings.name = "Negocio recuperado";
      failSnapshot = true;
      return { kind: "ok", value: { id: p.id, revision: 1 } };
    }
    if (method === "snapshot" && failSnapshot) {
      failSnapshot = false;
      throw Error("Read failure");
    }
    return base(method, params);
  });
  const { dialog, trigger } = await open(f);
  expect(within(dialog).getByText(es.backupMissing.initialPayment)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: es.confirmRestore }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(await screen.findByRole("alert")).toHaveTextContent(es.errors.E_REFRESH_REQUIRED);
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: es.retry }));
  await waitFor(() =>
    expect(screen.getByLabelText(es.businessName)).toHaveValue("Negocio recuperado"),
  );
  expect(confirmCount).toBe(1);
  fireEvent.click(trigger);
  expect(
    within(screen.getByRole("dialog")).getByRole("button", { name: es.confirmRestore }),
  ).toBeDisabled();
});
it("keeps a cancelled or lost confirmation pending and retries the exact key inside the modal", async () => {
  const f = fixture(),
    base = f.invoke.getMockImplementation();
  if (!base) throw Error("Missing fixture");
  const keys: string[] = [];
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "backupPrepare") return { kind: "ok", value: preview };
    if (method === "confirmRestore") {
      const p = restoreInputSchema.parse(params);
      keys.push(p.key);
      if (keys.length === 1) throw { code: "E_CANCELLED" };
      f.data.revision = 1;
      return { kind: "ok", value: { id: p.id, revision: 1 } };
    }
    return base(method, params);
  });
  const { dialog } = await open(f);
  fireEvent.click(within(dialog).getByRole("button", { name: es.confirmRestore }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(es.errors.E_OPERATION_PENDING);
  expect(within(dialog).getByRole("button", { name: es.confirmRestore })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("button", { name: es.retryOperation }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
it("returns focus on Escape and X, and picker cancellation does not invoke preparation", async () => {
  const f = fixture(),
    base = f.invoke.getMockImplementation();
  if (!base) throw Error("Missing fixture");
  f.invoke.mockImplementation(async (method, params) =>
    method === "backupPrepare" ? { kind: "ok", value: preview } : base(method, params),
  );
  const { dialog, trigger } = await open(f);
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.close }));
  await waitFor(() => expect(trigger).toHaveFocus());
  const count = f.invoke.mock.calls.filter(([method]) => method === "backupPrepare").length;
  f.files.pickOpen.mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: es.chooseBackup }));
  await waitFor(() => expect(screen.getByRole("button", { name: es.chooseBackup })).toBeEnabled());
  expect(f.invoke.mock.calls.filter(([method]) => method === "backupPrepare")).toHaveLength(count);
});
it("keeps a rejected preview invalid after snapshot failure and recovery", async () => {
  const f = fixture(),
    base = f.invoke.getMockImplementation();
  if (!base) throw Error("Missing fixture");
  let readFailed = false;
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "backupPrepare") return { kind: "ok", value: preview };
    if (method === "confirmRestore") {
      readFailed = true;
      return { kind: "rejected", issue: { code: "E_BACKUP_CHANGED" } };
    }
    if (method === "snapshot" && readFailed) {
      readFailed = false;
      throw Error("Read failed");
    }
    return base(method, params);
  });
  const { dialog } = await open(f);
  fireEvent.click(within(dialog).getByRole("button", { name: es.confirmRestore }));
  await waitFor(() =>
    expect(
      within(dialog)
        .getAllByRole("alert")
        .some((node) => node.textContent?.includes(es.errors.E_RELOAD_REQUIRED)),
    ).toBe(true),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: es.retry }));
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: es.confirmRestore })).toBeDisabled(),
  );
  expect(within(dialog).getByText(es.backupStale)).toBeInTheDocument();
});

it("formats complete preview totals with en-US currency without losing BigInt cents", async () => {
  await i18n.changeLanguage("en");
  render(<BackupPreview preview={{ ...preview, balance: "9007199254740993" }} />);
  expect(screen.getByText("MX$90,071,992,547,409.93")).toBeInTheDocument();
});
it("releases a terminal source-read failure, invalidates the old preview, and allows selecting again", async () => {
  const f = fixture(),
    base = f.invoke.getMockImplementation();
  if (!base) throw Error("Missing fixture");
  let count = 0;
  f.invoke.mockImplementation(async (method, params) => {
    if (method === "backupPrepare")
      return { kind: "ok", value: { ...preview, id: count++ ? crypto.randomUUID() : preview.id } };
    if (method === "confirmRestore") {
      restoreInputSchema.parse(params);
      return { kind: "rejected", issue: { code: "E_BACKUP_SOURCE" } };
    }
    return base(method, params);
  });
  const { dialog, trigger } = await open(f);
  fireEvent.click(within(dialog).getByRole("button", { name: es.confirmRestore }));
  await waitFor(() =>
    expect(
      within(dialog)
        .getAllByRole("alert")
        .some((n) => n.textContent?.includes(es.errors.E_BACKUP_SOURCE)),
    ).toBe(true),
  );
  expect(within(dialog).getByRole("button", { name: es.confirmRestore })).toBeDisabled();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  const choose = screen.getByRole("button", { name: es.chooseBackup });
  expect(choose).toBeEnabled();
  fireEvent.click(choose);
  await waitFor(() => expect(count).toBe(2));
  fireEvent.click(screen.getByRole("button", { name: es.restoreBackup }));
  expect(
    within(screen.getByRole("dialog")).getByRole("button", { name: es.confirmRestore }),
  ).toBeEnabled();
});

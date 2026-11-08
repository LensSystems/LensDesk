import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it } from "vitest";
import es from "../../locales/es.json";
import type { PreparedBackup } from "../shared/backup-contracts.ts";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { es: { translation: es } }, lng: "es" });
});
it("uses first insertion independently of draft, explicit cart request, and first insertion after restore", async () => {
  const f = fixture(),
    ids = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [i, id] of ids.entries()) {
    f.data.clients.push({
      id,
      name: i === 0 ? "Zeta primera" : "Alfa borrador",
      phone: "",
      term: 15,
      limit: null,
      active: true,
    });
    f.data.accounts.push({ clientId: id, balance: 0, overdue: 0, nextDue: null, totalPaid: 0 });
  }
  f.data.draft.clientId = ids[1] ?? null;
  f.mount();
  await screen.findByText(es.emptyCatalog);
  const tab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));
  tab(es.nav.accounts);
  expect(screen.getByRole("heading", { name: "Zeta primera" })).toBeVisible();
  tab(es.nav.sale);
  fireEvent.click(screen.getByRole("button", { name: es.viewAccount }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Alfa borrador" })).toHaveFocus());
  tab(es.nav.inventory);
  tab(es.nav.accounts);
  expect(screen.getByRole("heading", { name: "Alfa borrador" })).toBeVisible();
  const preview: PreparedBackup = {
    id: crypto.randomUUID(),
    hash: "a".repeat(64),
    revision: 0,
    name: "same.json",
    format: "web1",
    createdAt: "2026-11-07T18:00:00Z",
    counts: { products: 0, clients: 2, sales: 0, payments: 0, returns: 0, cash_sessions: 0 },
    balance: "0",
    stockValue: "0",
    limitations: [],
  };
  const base = f.invoke.getMockImplementation();
  if (!base) throw Error("Missing fixture");
  f.invoke.mockImplementation(async (method, params) =>
    method === "backupPrepare"
      ? { kind: "ok", value: preview }
      : method === "confirmRestore"
        ? { kind: "ok", value: { id: preview.id, revision: ++f.data.revision } }
        : base(method, params),
  );
  f.files.pickOpen.mockResolvedValue([{ token: "opaque", name: "same.json", size: 1 }]);
  tab(es.nav.settings);
  tab(es.settingsCategory.backups);
  fireEvent.click(screen.getByRole("button", { name: es.chooseBackup }));
  await screen.findByText("same.json");
  fireEvent.click(screen.getByRole("button", { name: es.restoreBackup }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: es.confirmRestore }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  tab(es.nav.accounts);
  expect(screen.getByRole("heading", { name: "Zeta primera" })).toBeVisible();
  expect(f.data.draft.clientId).toBe(ids[1]);
});

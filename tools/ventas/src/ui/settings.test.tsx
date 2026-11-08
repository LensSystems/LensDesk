import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { normalizeSettings } from "../shared/values.ts";
import { ClientDialog } from "./ClientDialog.tsx";
import type { ScreenProps } from "./types.ts";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});
beforeEach(async () => {
  await i18n.changeLanguage("es");
});
const select = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));
async function open(f: ReturnType<typeof fixture>) {
  f.mount();
  await screen.findByText(es.emptyCatalog);
  select(es.nav.settings);
}

describe("focused settings and effective defaults", () => {
  it("shows four vertical categories, honest empty details, and a focal business editor", async () => {
    const f = fixture();
    await open(f);
    const list = screen.getByRole("tablist", { name: es.settingsCategories });
    expect(list).toHaveAttribute("aria-orientation", "vertical");
    expect(within(list).getAllByRole("tab")).toHaveLength(4);
    expect(screen.queryByLabelText(es.businessName)).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: es.editBusiness });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(es.businessName), {
      target: { value: "Mi tienda" },
    });
    fireEvent.change(within(dialog).getByLabelText(es.ownerNameInput), {
      target: { value: "Propietaria" },
    });
    fireEvent.change(within(dialog).getByLabelText(es.address), { target: { value: "Calle" } });
    fireEvent.change(within(dialog).getByLabelText(es.phone), { target: { value: "123" } });
    fireEvent.change(within(dialog).getByLabelText(es.rfcOptional), {
      target: { value: "RFC original" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: es.saveBusinessData }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(f.data.settings).toMatchObject({
      name: "Mi tienda",
      ownerName: "Propietaria",
      rfc: "RFC original",
    });
    const calls = f.invoke.mock.calls.filter(([method]) => method === "backupInfo").length;
    select(es.settingsCategory.backups);
    expect(screen.getByRole("button", { name: es.chooseBackup })).toBeInTheDocument();
    select(es.settingsCategory.business);
    expect(screen.queryByRole("button", { name: es.chooseBackup })).not.toBeInTheDocument();
    expect(f.invoke.mock.calls.filter(([method]) => method === "backupInfo")).toHaveLength(calls);
    select(es.settingsCategory.banks);
    expect(
      within(screen.getByRole("tabpanel", { name: es.settingsCategory.banks })).getByText(
        es.noConfiguredBanks,
      ),
    ).toBeInTheDocument();
    expect(f.data.settings.banks).toEqual([]);
  });
  it("requires reference business fields and allows Cancel without submitting", async () => {
    const f = fixture();
    await open(f);
    const trigger = screen.getByRole("button", { name: es.editBusiness });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    for (const label of [es.businessName, es.ownerNameInput, es.address, es.phone])
      expect(within(dialog).getByLabelText(label)).toBeRequired();
    expect(within(dialog).getByLabelText(es.rfcOptional)).not.toBeRequired();
    fireEvent.change(within(dialog).getByLabelText(es.businessName), { target: { value: "   " } });
    expect(
      (within(dialog).getByLabelText(es.businessName) as HTMLInputElement).validity.patternMismatch,
    ).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: es.saveBusinessData }));
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: es.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("preserves an uncertain command after Cancel and retries its original body from the page", async () => {
    const f = fixture();
    Object.assign(f.data.settings, {
      name: "Original",
      ownerName: "Dueña",
      address: "Calle",
      phone: "123",
    });
    await open(f);
    fireEvent.click(screen.getByRole("button", { name: es.editBusiness }));
    fireEvent.change(screen.getByLabelText(es.businessName), { target: { value: "Pendiente" } });
    const base = f.invoke.getMockImplementation();
    if (!base) throw Error("Missing fixture");
    let committed: unknown;
    f.invoke
      .mockImplementationOnce(async (method, params) => {
        committed = await base(method, params);
        throw Error("Lost response");
      })
      .mockImplementationOnce(async () => committed);
    fireEvent.click(screen.getByRole("button", { name: es.saveBusinessData }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(
      es.errors.E_OPERATION_PENDING,
    );
    const original = f.invoke.mock.calls.find(([method]) => method === "execute")?.[1];
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: es.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: es.settingsCategory.business })).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: es.retryOperation }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: es.editBusiness })).toBeEnabled(),
    );
    const commands = f.invoke.mock.calls.filter(([method]) => method === "execute");
    expect(commands).toHaveLength(2);
    expect(commands[1]?.[1]).toEqual(original);
    expect(f.data.revision).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: es.editBusiness }));
    expect(screen.getByLabelText(es.businessName)).toHaveValue("Pendiente");
  });
  it("locks fields only after confirmed close is requested while refresh is pending", async () => {
    const f = fixture();
    Object.assign(f.data.settings, {
      name: "Original",
      ownerName: "Dueña",
      address: "Calle",
      phone: "123",
    });
    await open(f);
    fireEvent.click(screen.getByRole("button", { name: es.editBusiness }));
    const input = screen.getByLabelText(es.businessName);
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: "Confirmado" } });
    const base = f.invoke.getMockImplementation();
    if (!base) throw Error("Missing fixture");
    let pending = false,
      finish!: (value: unknown) => void;
    f.invoke.mockImplementation(async (method, params) => {
      if (method === "execute") {
        const result = await base(method, params);
        pending = true;
        return result;
      }
      if (method === "snapshot" && pending)
        return await new Promise((resolve) => {
          finish = resolve;
        });
      return await base(method, params);
    });
    fireEvent.click(screen.getByRole("button", { name: es.saveBusinessData }));
    await waitFor(() => expect(input).toBeDisabled());
    expect(input).toHaveValue("Confirmado");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
    await act(async () => finish(await base("snapshot")));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(f.data.settings.name).toBe("Confirmado");
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
  });
  it("rejects whitespace bank and holder before execute and accepts an empty alias", async () => {
    const f = fixture();
    await open(f);
    select(es.settingsCategory.banks);
    fireEvent.click(screen.getByRole("button", { name: es.addBank }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(es.bank), { target: { value: "Banco válido" } });
    fireEvent.change(within(dialog).getByLabelText(es.holder), {
      target: { value: "Titular válido" },
    });
    fireEvent.change(within(dialog).getByLabelText(es.clabe), {
      target: { value: "012345678901234567" },
    });
    expect(within(dialog).getByLabelText(es.bankAlias)).not.toBeRequired();
    for (const [label, valid] of [
      [es.bank, "Banco válido"],
      [es.holder, "Titular válido"],
    ] as const) {
      const input = within(dialog).getByLabelText(label);
      fireEvent.change(input, { target: { value: "   " } });
      expect(input).toBeInvalid();
      fireEvent.click(within(dialog).getByRole("button", { name: es.saveBank }));
      expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(0);
      expect(f.data.revision).toBe(0);
      expect(f.data.settings.banks).toEqual([]);
      fireEvent.change(input, { target: { value: valid } });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: es.saveBank }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(f.data.settings.banks).toHaveLength(1);
    expect(f.data.settings.banks[0]).toMatchObject({
      bank: "Banco válido",
      holder: "Titular válido",
      alias: "",
    });
    expect(f.data.revision).toBe(1);
    expect(f.invoke.mock.calls.filter(([method]) => method === "execute")).toHaveLength(1);
  });
  it("removes the default bank with a real dialog, selects the remaining bank and never prints aliases or owner", async () => {
    const f = fixture();
    const first = crypto.randomUUID(),
      second = crypto.randomUUID();
    f.data.settings = normalizeSettings({
      ...f.data.settings,
      ownerName: "DUEÑO PRIVADO",
      banks: [
        {
          id: first,
          bank: "Banco A",
          holder: "Titular A",
          clabe: "012345678901234567",
          alias: "ALIAS INTERNO A",
        },
        {
          id: second,
          bank: "Banco B",
          holder: "Titular B",
          clabe: "012345678901234568",
          alias: "ALIAS INTERNO B",
        },
      ],
    });
    await open(f);
    const paper = screen.getByRole("article", { name: es.settingsPreviewPaper });
    expect(paper).toHaveTextContent("Banco A");
    expect(paper).not.toHaveTextContent("ALIAS");
    expect(paper).not.toHaveTextContent("DUEÑO PRIVADO");
    select(es.settingsCategory.banks);
    const card = screen.getByText("ALIAS INTERNO A").closest("article");
    if (!card) throw Error("Missing account card");
    fireEvent.click(within(card).getByRole("button", { name: es.removeBank }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: es.removeBank }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(f.data.settings.defaultBankId).toBe(second);
    await waitFor(() =>
      expect(screen.getByRole("article", { name: "ALIAS INTERNO B · Banco B" })).toHaveFocus(),
    );
    expect(f.data.settings.banks).toHaveLength(1);
    expect(paper).toHaveTextContent("Banco B");
    expect(paper).not.toHaveTextContent("ALIAS");
  });
  it("preserves the original legacy bank identity through the actual bank editor", async () => {
    const f = fixture();
    const originalId = crypto.randomUUID(),
      id = crypto.randomUUID();
    f.data.settings = normalizeSettings({
      ...f.data.settings,
      banks: [
        {
          id,
          originalId,
          bank: "Bank",
          holder: "Holder",
          clabe: "012345678901234567",
          alias: "Legacy",
        },
      ],
    });
    await open(f);
    select(es.settingsCategory.banks);
    fireEvent.click(screen.getByRole("button", { name: es.editBank }));
    fireEvent.change(screen.getByLabelText(es.bankAlias), { target: { value: "Edited alias" } });
    fireEvent.click(screen.getByRole("button", { name: es.saveBank }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(f.data.settings.banks[0]).toMatchObject({ id, originalId, alias: "Edited alias" });
    const command = f.invoke.mock.calls.find(([method]) => method === "execute")?.[1];
    expect(command).toMatchObject({ action: { settings: { banks: [{ id, originalId }] } } });
  });
  it("uses the saved term only for a newly opened client and keeps an open draft stable", async () => {
    const f = fixture();
    f.data.settings = normalizeSettings({ ...f.data.settings, defaultTerm: 21 });
    const props: ScreenProps = {
      data: f.data,
      run: vi.fn(async () => false),
      busy: false,
      read: f.invoke,
      operation: {
        issue: null,
        writing: false,
        loading: false,
        pendingConfirmation: false,
        confirmedOwner: null,
        confirmedId: null,
        retry: vi.fn(),
      },
    };
    const view = render(<ClientDialog {...props} close={vi.fn()} />);
    expect(screen.getByLabelText(es.paymentDays)).toHaveValue(21);
    fireEvent.change(screen.getByLabelText(es.paymentDays), { target: { value: "17" } });
    view.rerender(
      <ClientDialog
        {...props}
        data={{ ...f.data, settings: { ...f.data.settings, defaultTerm: 30 } }}
        close={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(es.paymentDays)).toHaveValue(17);
  });
  it("saves term preferences without mutating existing clients and inherits English labels", async () => {
    const f = fixture();
    f.data.clients.push({
      id: crypto.randomUUID(),
      name: "Anterior",
      phone: "",
      term: 9,
      limit: null,
      active: true,
    });
    await open(f);
    select(es.settingsCategory.receipts);
    fireEvent.click(screen.getByRole("button", { name: "21 días" }));
    await waitFor(() => expect(f.data.settings.defaultTerm).toBe(21));
    expect(f.data.clients[0]?.term).toBe(9);
    await act(async () =>
      f.context({
        theme: "dark",
        accent: "green",
        locale: "en",
        hostVersion: "0.5.0",
        toolVersion: "0.1.0",
      }),
    );
    expect(screen.getByRole("tab", { name: en.settingsCategory.receipts })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(en.chooseTerm)).toBeVisible();
    expect(screen.getByRole("combobox", { name: en.defaultTermLabel })).toBeInTheDocument();
  });
});

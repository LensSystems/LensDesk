import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { SummaryPage } from "./SummaryPage.tsx";
import { TicketsPage } from "./TicketsPage.tsx";
import type { ScreenProps } from "./types.ts";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es } },
    lng: "es",
    interpolation: { escapeValue: false },
  });
});
function props(): ScreenProps {
  return {
    data: fixture().data,
    read: vi.fn(async () => ({ kind: "rejected", issue: { code: "E_LIMIT" } })),
    run: vi.fn(async () => false),
    busy: false,
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
}
it("advances Summary presets with today and preserves a custom range", async () => {
  const p = props(),
    view = render(<SummaryPage {...p} />);
  await waitFor(() =>
    expect(p.read).toHaveBeenLastCalledWith("summary", { from: "2026-11-07", to: "2026-11-07" }),
  );
  p.data = { ...p.data, today: "2026-12-01", revision: 1 };
  view.rerender(<SummaryPage {...p} />);
  await waitFor(() =>
    expect(p.read).toHaveBeenLastCalledWith("summary", { from: "2026-12-01", to: "2026-12-01" }),
  );
  fireEvent.click(screen.getByRole("button", { name: es.periods.month }));
  fireEvent.change(screen.getByLabelText(es.fromDate), { target: { value: "2026-11-20" } });
  p.data = { ...p.data, today: "2026-12-02", revision: 2 };
  view.rerender(<SummaryPage {...p} />);
  await waitFor(() =>
    expect(p.read).toHaveBeenLastCalledWith("summary", { from: "2026-11-20", to: "2026-12-01" }),
  );
});
for (const View of [TicketsPage, HistoryPanel])
  it(`advances ${View.name} Today with the operational date`, async () => {
    const p = props(),
      view = render(<View {...p} kind="sales" />);
    fireEvent.click(screen.getByRole("button", { name: es.periods.today }));
    await waitFor(() =>
      expect(p.read).toHaveBeenCalledWith(
        "history",
        expect.objectContaining({ from: "2026-11-07", to: "2026-11-07" }),
      ),
    );
    p.data = { ...p.data, today: "2026-11-08", revision: 1 };
    view.rerender(<View {...p} kind="sales" />);
    await waitFor(() =>
      expect(p.read).toHaveBeenCalledWith(
        "history",
        expect.objectContaining({ from: "2026-11-08", to: "2026-11-08", offset: 0 }),
      ),
    );
  });

for (const View of [TicketsPage, HistoryPanel])
  it(`caps pasted ${View.name} search at the backend limit`, async () => {
    const p = props();
    p.read = vi.fn(async () => ({
      kind: "ok",
      value: { revision: 0, total: 0, nextOffset: null, rows: [] },
    }));
    render(<View {...p} kind="sales" />);
    const search = screen.getByLabelText(es.searchHistory);
    expect(search).toHaveAttribute("maxlength", "120");
    fireEvent.change(search, { target: { value: "x".repeat(121) } });
    expect(search).toHaveValue("x".repeat(120));
    await waitFor(() =>
      expect(p.read).toHaveBeenCalledWith(
        "history",
        expect.objectContaining({ query: "x".repeat(120) }),
      ),
    );
    expect(
      vi
        .mocked(p.read)
        .mock.calls.every(
          ([method, params]) =>
            method !== "history" || String((params as { query: string }).query).length <= 120,
        ),
    ).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

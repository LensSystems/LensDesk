import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import type { HistoryRow } from "../shared/history-contracts.ts";
import { AccountAllocations } from "./AccountAllocations.tsx";
import { fixture } from "./ui-fixture.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ resources: { es: { translation: es } }, lng: "es" });
});
it("consults the51st allocation with a real bounded history request and preserves payment identity", async () => {
  const f = fixture(),
    payment = {
      id: crypto.randomUUID(),
      folio: 1,
      clientId: crypto.randomUUID(),
      amount: 5100,
      method: "cash",
      bankId: null,
      bankSnapshot: null,
      reference: "",
      cashId: null,
      opening: false,
      reversalId: null,
      reversal: null,
      applied: null,
      date: f.data.today,
      at: "2026-11-07T18:00:00Z",
    } as Extract<HistoryRow, { kind: "payment" }>["data"];
  const allocations = Array.from({ length: 51 }, (_, i) => ({
    saleId: crypto.randomUUID(),
    folio: i + 1,
    opening: true,
    amount: 100,
  }));
  const read = vi.fn(async (_method: string, params?: unknown) => {
    const { allocationOffset: offset } = params as { allocationOffset: number };
    return {
      kind: "ok",
      value: {
        revision: 0,
        total: 1,
        nextOffset: null,
        rows: [
          {
            kind: "payment",
            data: {
              ...payment,
              allocationPage: {
                total: 51,
                nextOffset: offset === 0 ? 50 : null,
                rows: allocations.slice(offset, offset + 50),
              },
            },
          },
        ],
      },
    };
  });
  render(<AccountAllocations data={f.data} read={read} payment={payment} />);
  await screen.findByText(/SI-000050/);
  expect(screen.queryByText(/SI-000051/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: es.nextPage }));
  await screen.findByText(/SI-000051/);
  expect(read).toHaveBeenLastCalledWith("history", {
    kind: "payments",
    paymentId: payment.id,
    allocationOffset: 50,
    limit: 1,
    revision: 0,
  });
  expect(screen.queryByText(/SI-000050/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: es.nextPage })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: es.previousPage }));
  await waitFor(() => expect(screen.getByText(/SI-000001/)).toBeVisible());
  expect(payment.amount).toBe(5100);
  expect(read.mock.calls.every(([method]) => method === "history")).toBe(true);
});

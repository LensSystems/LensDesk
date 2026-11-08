import type { createToolClient } from "@lensdesk/sdk";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Command, Snapshot } from "../shared/contracts.ts";
import type { HistoryRow, SaleDetail, Statement } from "../shared/history-contracts.ts";
import { App } from "./App.tsx";

export type Context = Awaited<ReturnType<ReturnType<typeof createToolClient>["app"]["getContext"]>>;
export const pid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d0";
export function fixture() {
  const data: Snapshot = {
    revision: 0,
    clients: [],
    accounts: [],
    outflows: [],
    closings: [],
    cash: null,
    draft: { clientId: null, lines: [] },
    today: "2026-11-07",
    products: [],
    recipes: [],
    movements: [],
    purchases: [],
    settings: { name: "", address: "", phone: "", thanks: "", banks: [] },
  };
  const rows: HistoryRow[] = [];
  const details: Record<string, SaleDetail> = {};
  const statements: Record<string, Statement> = {};
  let listener: ((context: Context) => void) | undefined;
  let current: Context = {
    theme: "light",
    locale: "es",
    accent: "blue",
    hostVersion: "0.5.0",
    toolVersion: "0.1.0",
  };
  const getContext = vi.fn(async (): Promise<Context> => ({ ...current }));
  const invoke = vi.fn(async (method: string, params?: unknown): Promise<unknown> => {
    if (method === "snapshot") return { kind: "ok", value: structuredClone(data) };
    if (method === "history") {
      const p = params as {
        kind: string;
        clientId?: string;
        query?: string;
        offset?: number;
        limit?: number;
        from?: string;
        to?: string;
        excludeOpening?: boolean;
      };
      const kinds: Record<string, string> = {
        sales: "sale",
        payments: "payment",
        returns: "return",
        inventory: "inventory",
        outflows: "outflow",
        purchases: "purchase",
        closings: "closing",
      };
      const all = rows.filter(
        (row) =>
          row.kind === kinds[p.kind] &&
          (!p.excludeOpening || row.kind !== "sale" || !row.data.opening) &&
          (!p.query || JSON.stringify(row).toLowerCase().includes(p.query.toLowerCase())) &&
          (!p.from || (row.kind === "closing" ? row.data.closedDate : row.data.date) >= p.from) &&
          (!p.to || (row.kind === "closing" ? row.data.closedDate : row.data.date) <= p.to),
      );
      const offset = p.offset ?? 0,
        limit = p.limit ?? 20;
      return {
        kind: "ok",
        value: {
          revision: data.revision,
          total: all.length,
          rows: all.slice(offset, offset + limit),
          nextOffset: offset + limit < all.length ? offset + limit : null,
        },
      };
    }
    if (method === "saleDetail") {
      const p = params as { saleId: string };
      return details[p.saleId]
        ? { kind: "ok", value: details[p.saleId] }
        : { kind: "rejected", issue: { code: "E_NOT_FOUND" } };
    }
    if (method === "statement") {
      const p = params as { clientId: string; bankId: string | null };
      if (statements[p.clientId]) return { kind: "ok", value: statements[p.clientId] };
      const client = data.clients.find((c) => c.id === p.clientId),
        account = data.accounts.find((a) => a.clientId === p.clientId),
        page = { revision: data.revision, total: 0, rows: [], nextOffset: null };
      return {
        kind: "ok",
        value: {
          revision: data.revision,
          client,
          business: data.settings,
          bankSnapshot: data.settings.banks.find((b) => b.id === p.bankId) ?? null,
          account,
          today: data.today,
          salesPage: page,
          sales: [],
          payments: page,
          returns: page,
        },
      };
    }
    const command = params as Command;
    if (command.action.type === "saveProduct")
      data.products.push({
        ...command.action.product,
        id: pid,
        stock: 0,
        value: 0,
        lastValue: 0,
        lastQty: 1,
        active: true,
      });
    if (command.action.type === "saveDraft") data.draft = structuredClone(command.action.draft);
    if (command.action.type === "sell") data.draft.lines = [];
    if (command.action.type === "saveSettings")
      data.settings = structuredClone(command.action.settings);
    data.revision += 1;
    return { kind: "ok", value: { id: pid, revision: data.revision } };
  });
  const client = {
    app: {
      getContext,
      onContextChange: (cb: (ctx: Context) => void) => {
        listener = cb;
        return vi.fn();
      },
    },
    backend: { invoke },
  } as unknown as ReturnType<typeof createToolClient>;
  return {
    data,
    rows,
    details,
    statements,
    invoke,
    getContext,
    mount: () => render(<App client={client} />),
    context: (ctx: Context) => {
      current = ctx;
      listener?.(ctx);
    },
  };
}

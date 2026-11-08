import type { createToolClient } from "@lensdesk/sdk";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { Command, Snapshot } from "../shared/contracts.ts";
import { App } from "./App.tsx";

export type Context = Awaited<ReturnType<ReturnType<typeof createToolClient>["app"]["getContext"]>>;
export const pid = "9d44e2be-d3d6-4d73-ad57-65011a4a12d0";
export function fixture() {
  const data: Snapshot = {
    revision: 0,
    clients: [],
    sales: [],
    payments: [],
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
    invoke,
    getContext,
    mount: () => render(<App client={client} />),
    context: (ctx: Context) => {
      current = ctx;
      listener?.(ctx);
    },
  };
}

import { describe, expect, it, vi } from "vitest";
import { createBackendHost } from "./backend-host.ts";

vi.mock("electron", () => ({ utilityProcess: {} }));

// Backend simulado: responde a cada petición y anota las cancelaciones recibidas.
function setup() {
  const sent: { type: string; id: number }[] = [];
  let clock = 0;
  const host = createBackendHost({
    userData: `${process.env.TMPDIR ?? "/tmp"}/lensdesk-backend-host-test`,
    hostVersion: "0.0.0",
    getTool: (id) => ({ id, installPath: "/tool", version: "1.0.0" }),
    resolveFile: async () => undefined,
    now: () => clock,
    fork: () => {
      let onMessage: (message: unknown) => void = () => undefined;
      return {
        postMessage: (message: unknown) => {
          const msg = message as { type: string; id: number };
          if (msg.type === "request" || msg.type === "cancel") sent.push(msg);
          // La petición queda pendiente hasta que el test la resuelva.
          if (msg.type === "request")
            setTimeout(() => onMessage({ type: "response", id: msg.id, result: "ok" }), 0);
        },
        on: (event: string, listener: (...args: never[]) => void) => {
          if (event === "message") onMessage = listener as never;
        },
        kill: () => undefined,
      };
    },
  });
  return {
    host,
    sent,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}
const noProgress = () => undefined;

describe("cancelaciones anticipadas del backend", () => {
  it("aplica una cancelación que llegó antes que su llamada", async () => {
    const { host, sent } = setup();
    host.cancel("notes", "r1");
    const result = host.invoke("notes", "r1", "m", {}, noProgress);
    await result;
    expect(sent.some((m) => m.type === "cancel")).toBe(true);
  });

  it("descarta una cancelación caducada: no cancela una llamada posterior con el mismo id", async () => {
    const { host, sent, advance } = setup();
    host.cancel("notes", "r1");
    advance(60_000);
    await host.invoke("notes", "r1", "m", {}, noProgress);
    expect(sent.some((m) => m.type === "cancel")).toBe(false);
  });

  it("limita las cancelaciones guardadas por herramienta", async () => {
    const { host, sent } = setup();
    for (let i = 0; i < 500; i += 1) host.cancel("notes", `huerfana-${i}`);
    // La más antigua ya se descartó por el tope; la más reciente sigue vigente.
    await host.invoke("notes", "huerfana-0", "m", {}, noProgress);
    expect(sent.some((m) => m.type === "cancel")).toBe(false);
    await host.invoke("notes", "huerfana-499", "m", {}, noProgress);
    expect(sent.some((m) => m.type === "cancel")).toBe(true);
  });
});

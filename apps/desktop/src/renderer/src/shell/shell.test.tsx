import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { App } from "./App.tsx";

function bridgeMock() {
  return {
    invoke: vi.fn(async (channel: string, payload: { toolId?: string; page?: string }) => {
      if (channel === "tabs.list")
        return {
          ok: true as const,
          data: {
            tabs: [
              { toolId: "notas", position: 0, active: true },
              { toolId: "convertidor", position: 1, active: false },
            ],
          },
        };
      if (channel === "settings.get")
        return { ok: true as const, data: { key: "locale", value: "es" } };
      if (channel === "app.getContext")
        return { ok: true as const, data: { locale: "es" as const, theme: "dark" as const } };
      return {
        ok: true as const,
        data: channel === "shell.showPage" ? { page: payload.page } : { tabs: [] },
      };
    }),
    on: () => () => undefined,
  } as unknown as HostBridge;
}

describe("shell", () => {
  it("da nombre accesible a cada botón y pestaña en español", async () => {
    await rendererI18n.changeLanguage("es");
    const bridge = bridgeMock();
    useShellStore.setState({
      tabs: [
        { toolId: "notas", position: 0, active: true },
        { toolId: "convertidor", position: 1, active: false },
      ],
      page: "tab",
    });
    render(<App bridge={bridge} />);
    const buttons = screen.getAllByRole("button");
    const tabs = screen.getAllByRole("tab");
    expect(
      [...buttons, ...tabs].every(
        (item) => item.getAttribute("aria-label")?.trim() || item.textContent?.trim(),
      ),
    ).toBe(true);
    expect(screen.getByRole("tablist", { name: "Pestañas abiertas" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "notas" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tab", { name: "convertidor" }).getAttribute("tabindex")).toBe("-1");
  });

  it("mueve foco y tabindex con flechas, Home y End; cerrar no activa", async () => {
    const bridge = bridgeMock();
    useShellStore.setState({
      tabs: [
        { toolId: "notas", position: 0, active: true },
        { toolId: "convertidor", position: 1, active: false },
      ],
      page: "tab",
    });
    render(<App bridge={bridge} />);
    const first = screen.getByRole("tab", { name: "notas" });
    const second = screen.getByRole("tab", { name: "convertidor" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
    expect(first.getAttribute("tabindex")).toBe("-1");
    expect(second.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(second, { key: "Home" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "End" });
    expect(document.activeElement).toBe(second);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar convertidor" }));
    expect(bridge.invoke).toHaveBeenCalledWith("tabs.close", { toolId: "convertidor" });
    expect(bridge.invoke).not.toHaveBeenCalledWith("tabs.activate", { toolId: "convertidor" });
    fireEvent.click(first);
    expect(bridge.invoke).toHaveBeenCalledWith("tabs.activate", { toolId: "notas" });
  });
});

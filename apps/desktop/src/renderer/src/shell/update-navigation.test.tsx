import { TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { HeaderNotices } from "./HeaderNotices.tsx";
import { SettingsPage } from "./SettingsPage.tsx";

const url = "https://github.com/o/r/releases/tag/v1.2.0";
beforeEach(async () => {
  await rendererI18n.changeLanguage("es");
  useShellStore.setState({
    page: "tools",
    update: null,
    dismissedVersion: null,
    updateSettingsRequest: 0,
    toasts: [],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it.each(["tools", "settings"] as const)(
  "llega desde %s con foco, resalte temporal y aviso cerrado",
  async (page) => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const invoke = vi.fn(async (channel: string) => ({
      ok: true,
      data:
        channel === "shell.showPage"
          ? { page: "settings" }
          : channel === "app.getInfo"
            ? { version: "0.3.0", releasesRepo: "o/r", platform: "darwin" }
            : channel === "settings.get"
              ? { key: "app.openAtLogin", value: false }
              : {},
    }));
    const bridge = createHostBridge(invoke, (event, callback) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    });
    const unsubscribe = useShellStore.getState().subscribe(bridge);
    useShellStore.setState({ page });
    render(
      <TooltipProvider>
        <HeaderNotices bridge={bridge} />
        <SettingsPage bridge={bridge} />
      </TooltipProvider>,
    );
    await screen.findByText("Versión 0.3.0");
    act(() => listeners.get("update.available")?.({ version: "1.2.0", html_url: url }));
    const scroll = vi.fn();
    const row = screen
      .getByRole("switch", { name: "Buscar actualizaciones" })
      .closest("[data-update-row]") as HTMLElement;
    row.scrollIntoView = scroll;
    fireEvent.click(screen.getByRole("button", { name: "Ir a Ajustes" }));
    await waitFor(() => expect(row).toHaveAttribute("data-highlighted", "true"));
    expect(useShellStore.getState().page).toBe("settings");
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.getByRole("link", { name: "Versión 1.2.0 disponible" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Ir a Ajustes" })).toBeNull();
    expect(invoke).toHaveBeenCalledWith("settings.set", {
      key: "updates.dismissedVersion",
      value: "1.2.0",
    });
    await waitFor(() => expect(row).toHaveAttribute("data-highlighted", "false"), {
      timeout: 2000,
    });
    expect(row).toHaveClass("duration-160", "ease-out", "motion-reduce:transition-none");
    expect(screen.getByRole("link", { name: "Versión 1.2.0 disponible" })).toHaveFocus();
    expect(useShellStore.getState().update?.version).toBe("1.2.0");
    unsubscribe();
  },
);

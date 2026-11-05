import { TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHostBridge } from "../../../shared/host-channels.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { initialUpdateState } from "../state/update-state.ts";
import {
  sampleBlocked,
  sampleSources,
  sampleTool,
  sampleUpdate,
} from "./independent-update-fixtures.ts";
import { SettingsUpdateStatus } from "./SettingsUpdateStatus.tsx";
import { ToolDialogs } from "./ToolDialogs.tsx";
import { ToolsPage } from "./ToolsPage.tsx";

const invoke = vi.fn(async (_channel: string, payload: unknown) => ({
  ok: true,
  data: payload ?? {},
}));
const bridge = createHostBridge(invoke, () => () => {});
beforeEach(async () => {
  await rendererI18n.changeLanguage("es");
  useShellStore.setState({
    ...initialUpdateState(),
    tools: [sampleTool(), sampleTool("md-converter")],
    page: "settings",
    pendingDowngrade: null,
  });
  invoke.mockClear();
});
afterEach(cleanup);
function status(source = sampleSources(), checking = false, enabled = true) {
  return (
    <SettingsUpdateStatus
      bridge={bridge}
      version="0.5.0"
      checking={checking}
      sources={source}
      update={source.app.update}
      enabled={enabled}
    />
  );
}

describe("resultados independientes con copy aprobada", () => {
  it.each(["es", "en"])(
    "muestra app sola, herramientas solas, ambas y plurales en %s",
    async (language) => {
      await rendererI18n.changeLanguage(language);
      const es = language === "es";
      const view = render(status(sampleSources()));
      expect(screen.getByRole("status")).toHaveTextContent(
        es ? "LensDesk 0.5.0 está actualizado." : "LensDesk 0.5.0 is up to date.",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        es ? "Todas las herramientas están actualizadas." : "All tools are up to date.",
      );
      view.rerender(status(sampleSources(0, true)));
      expect(
        screen.getByRole("link", {
          name: es ? "Versión 0.5.1 de LensDesk disponible" : "LensDesk version 0.5.1 available",
        }),
      ).toBeTruthy();
      view.rerender(status(sampleSources(1)));
      expect(
        screen.getByRole("link", {
          name: es
            ? "Hay una actualización disponible para una herramienta"
            : "An update is available for one tool",
        }),
      ).toBeTruthy();
      view.rerender(status(sampleSources(2, true)));
      expect(
        screen.getByRole("link", {
          name: es
            ? "Hay actualizaciones disponibles para 2 herramientas"
            : "Updates are available for 2 tools",
        }),
      ).toBeTruthy();
      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getAllByRole("link")).toHaveLength(3);
    },
  );
  it("conserva datos previos identificados sin afirmar actualizado para la fuente fallida", () => {
    const sources = sampleSources(1, true);
    sources.app.status = "error";
    const view = render(status(sources));
    expect(screen.getByRole("status")).toHaveTextContent(
      "No se pudo comprobar LensDesk. Vuelve a buscar.",
    );
    expect(
      screen.getByRole("link", { name: "Hay una actualización disponible para una herramienta" }),
    ).toBeTruthy();
    expect(screen.getByText("Resultados de una búsqueda anterior.")).toBeTruthy();
    view.rerender(
      status({
        ...sources,
        app: { status: "success", update: null },
        tools: { ...sources.tools, status: "error" },
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("LensDesk 0.5.0 está actualizado.");
    expect(
      within(document.querySelector("[data-swap-new]") as HTMLElement).getByText(
        "No se pudieron comprobar las herramientas. Vuelve a buscar.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Todas las herramientas están actualizadas.")).toBeNull();
    view.rerender(status(sampleSources()));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Todas las herramientas están actualizadas.",
    );
    expect(
      within(document.querySelector("[data-swap-new]") as HTMLElement).queryByText(
        "Resultados de una búsqueda anterior.",
      ),
    ).toBeNull();
  });
  it("no presenta sin consultar o disabled como actualizado y conserva enlaces anteriores", () => {
    render(status(sampleSources(1, true), false, false));
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("No se ha comprobado LensDesk.");
    expect(region).toHaveTextContent("No se han comprobado las herramientas.");
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(region).not.toHaveTextContent("está actualizado");
  });
  it("buscar solo anuncia la búsqueda y el contenido saliente permanece oculto e inerte", () => {
    const view = render(status(sampleSources(1, true)));
    view.rerender(status(sampleSources(1, true), true));
    const old = document.querySelector(".ld-swap-old");
    expect(old).toHaveAttribute("aria-hidden", "true");
    expect(old).toHaveAttribute("inert");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Buscando actualizaciones de LensDesk y herramientas…",
    );
  });
  it("recibir fuentes mientras busca no vuelve a animar el mismo anuncio", () => {
    const view = render(status(sampleSources(), true));
    view.rerender(status(sampleSources(2, true), true));
    expect(document.querySelector(".ld-swap-old")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Buscando actualizaciones de LensDesk y herramientas…",
    );
  });
  it("el enlace de conteo navega internamente sin consultar de nuevo", async () => {
    useShellStore.getState().receiveUpdateSources(sampleSources(1));
    render(status(sampleSources(1)));
    fireEvent.click(
      screen.getByRole("link", { name: "Hay una actualización disponible para una herramienta" }),
    );
    await act(async () => {});
    expect(invoke).toHaveBeenCalledWith("shell.showPage", { page: "tools" });
    expect(invoke).not.toHaveBeenCalledWith("updates.checkNow", {});
    expect(useShellStore.getState().updateSources).toEqual(sampleSources(1));
  });
  it("no cuenta herramientas no instaladas ni versiones ya instaladas", () => {
    useShellStore.setState({ tools: [sampleTool("notes", "v0.4.5+local")] });
    render(status(sampleSources(2)));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Todas las herramientas están actualizadas.",
    );
  });
  it.each([false, true])(
    "mantiene acciones compatibles y warning separado en tarjeta/detalles, API=%s",
    (api) => {
      const incompatible = sampleBlocked(api);
      const source = sampleSources(1);
      source.tools.incompatible = [incompatible];
      useShellStore.getState().receiveUpdateSources(source);
      const view = render(
        <TooltipProvider>
          <ToolsPage bridge={bridge} />
        </TooltipProvider>,
      );
      const article = screen.getByRole("heading", { level: 2, name: "Notas" }).closest("article");
      if (!article) throw Error("No card");
      expect(within(article).getAllByRole("button", { name: "Descargar" })).toHaveLength(1);
      expect(within(article).getAllByRole("button", { name: "Instalar archivo…" })).toHaveLength(1);
      fireEvent.click(within(article).getByRole("button", { name: "Descargar" }));
      expect(invoke).toHaveBeenCalledWith("app.openExternal", { url: sampleUpdate().url });
      expect(article).toHaveTextContent(
        api ? "No compatible con este LensDesk" : "Requiere LensDesk 0.6.0 o posterior.",
      );
      if (api) expect(article).not.toHaveTextContent("Requiere LensDesk 0.1.0");
      expect(within(article).getByRole("link", { name: "Ir a Ajustes" })).toBeTruthy();
      view.unmount();
      render(
        <TooltipProvider>
          <ToolDialogs
            state={{ kind: "details", tool: sampleTool() }}
            update={sampleUpdate()}
            incompatible={incompatible}
            status="success"
            bridge={bridge}
            pending={null}
            onClose={vi.fn()}
            onError={vi.fn()}
          />
        </TooltipProvider>,
      );
      expect(
        within(screen.getByRole("dialog")).getByText(
          api
            ? "Versión 0.6.0 · No compatible con este LensDesk"
            : "Versión 0.6.0 · Requiere actualizar LensDesk",
        ),
      ).toBeTruthy();
      expect(
        within(screen.getByRole("dialog")).getAllByRole("button", {
          name: "Descargar",
        }),
      ).toHaveLength(1);
    },
  );
  it("una versión solo incompatible no muestra descarga ni guía de instalación", () => {
    const sources = sampleSources();
    sources.tools.incompatible = [sampleBlocked()];
    useShellStore.getState().receiveUpdateSources(sources);
    render(
      <TooltipProvider>
        <ToolsPage bridge={bridge} />
      </TooltipProvider>,
    );
    expect(screen.queryByRole("button", { name: "Descargar" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Cómo actualizar tus herramientas" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ir a Ajustes" })).toBeTruthy();
  });
});

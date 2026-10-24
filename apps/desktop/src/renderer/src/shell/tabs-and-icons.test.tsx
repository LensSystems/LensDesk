import { Puzzle, StickyNote, TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostBridge } from "../../../shared/host-channels.ts";
import { HEADER_HEIGHT } from "../../../shared/layout.ts";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { App } from "./App.tsx";
import { TabBar } from "./TabBar.tsx";
import { toolIcon } from "./tool-icons.ts";

function renderBar(bridge: HostBridge) {
  return render(
    <TooltipProvider>
      <TabBar bridge={bridge} tabs={tabs} />
    </TooltipProvider>,
  );
}

const tabs = [
  { toolId: "notas", position: 0, active: false },
  { toolId: "conv", position: 1, active: true },
  { toolId: "otra", position: 2, active: false },
];
const tools = [
  { id: "notas", manifest: { icon: "sticky-note", name: { es: "Notas", en: "Notes" } } },
  { id: "conv", manifest: { name: { es: "Convertidor", en: "Converter" } } },
] as never;

function makeBridge(dismissed: string | null = null) {
  const listeners = new Map<string, (payload: unknown) => void>();
  const invoke = vi.fn(async (channel: string, payload: { key?: string }) => {
    if (channel === "settings.get")
      return {
        ok: true as const,
        data: {
          key: payload.key,
          value: payload.key === "updates.dismissedVersion" ? dismissed : "es",
        },
      };
    if (channel === "app.getContext")
      return { ok: true as const, data: { locale: "es" as const, theme: "dark" as const } };
    if (channel === "tabs.list") return { ok: true as const, data: { tabs: [] } };
    if (channel === "tools.list")
      return { ok: true as const, data: { tools: [], pendingDowngrade: null } };
    return { ok: true as const, data: {} };
  });
  const bridge = {
    invoke,
    on: (event: string, callback: (payload: unknown) => void) => {
      listeners.set(event, callback);
      return () => listeners.delete(event);
    },
  } as unknown as HostBridge;
  return { bridge, listeners, invoke };
}

describe("pestañas", () => {
  it("reordena con Ctrl+Mayús y anuncia la posición sin activar otra pestaña", async () => {
    const { bridge, invoke } = makeBridge();
    invoke.mockImplementation(async (channel: string) => {
      if (channel !== "tabs.move") throw new Error("Canal inesperado");
      return {
        ok: true as const,
        data: { tabs: [{ ...tabs[1], position: 0 }, { ...tabs[0], position: 1 }, tabs[2]] },
      } as never;
    });
    renderBar(bridge);
    const tab = screen.getByRole("tab", { name: "Notas" });
    expect(tab).toHaveAttribute("aria-posinset", "1");
    expect(tab).toHaveAttribute("aria-setsize", "3");
    fireEvent.keyDown(tab, { key: "ArrowLeft", ctrlKey: true, shiftKey: true });
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.keyDown(tab, { key: "ArrowRight", ctrlKey: true, shiftKey: true });
    expect(invoke).toHaveBeenCalledExactlyOnceWith("tabs.move", { toolId: "notas", toIndex: 1 });
    await waitFor(() => expect(screen.getByText("Notas, pestaña 2 de 3")).toBeInTheDocument());
  });

  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({ tabs, tools, page: "tab", fullScreen: false });
  });
  afterEach(cleanup);

  it("en mínima conserva el nombre solo de la seleccionada aunque haya espacio", () => {
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        return { width: this.tagName === "HEADER" ? 760 : 0, left: 0, right: 0 } as DOMRect;
      });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    try {
      renderBar(makeBridge().bridge);
      expect(
        screen.getByRole("tab", { name: "Notas" }).querySelector("[data-tab-name]"),
      ).toHaveClass("sr-only");
      expect(screen.getByRole("tab", { name: "Notas" }).parentElement).toHaveClass("w-[31px]");
      expect(
        screen.getByRole("tab", { name: "Convertidor" }).querySelector("[data-tab-name]"),
      ).toHaveClass("truncate");
      act(() => useShellStore.setState({ page: "tools" }));
      for (const tab of screen.getAllByRole("tab")) {
        expect(tab.querySelector("[data-tab-name]")).toHaveClass("sr-only");
        expect(tab).toHaveAttribute("aria-selected", "false");
      }
    } finally {
      bounds.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("usa un icono de cierre de 13 dentro del botón de 24", () => {
    renderBar(makeBridge().bridge);
    const close = screen.getByRole("button", { name: "Cerrar Notas" });
    expect(close).toHaveClass("size-6", "right-[3px]");
    expect(close.querySelector("svg")).toHaveAttribute("width", "13");
    expect(close.querySelector("svg")).toHaveAttribute("height", "13");
  });

  it("con más de cinco pestañas conserva solo el nombre de la activa", () => {
    const many = Array.from({ length: 8 }, (_, position) => ({
      toolId: `tool-${position}`,
      position,
      active: position === 7,
    }));
    render(
      <TooltipProvider>
        <TabBar bridge={makeBridge().bridge} tabs={many} />
      </TooltipProvider>,
    );
    for (const tab of many) {
      const button = screen.getByRole("tab", { name: tab.toolId });
      expect(button.querySelector("[data-tab-name]")?.className).toBe(
        tab.active ? "truncate" : "sr-only whitespace-nowrap",
      );
      expect(button.title).toBe(tab.active ? "" : tab.toolId);
    }
    expect(screen.getByRole("tablist").className).toContain("overflow-hidden");
  });

  it("compacta cuando el ancho disponible no alcanza", () => {
    let resize: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      renderBar(makeBridge().bridge);
      act(() =>
        resize?.([{ contentRect: { width: 300 } }] as ResizeObserverEntry[], {} as ResizeObserver),
      );
      expect(
        screen.getByRole("tab", { name: "Notas" }).querySelector("[data-tab-name]")?.className,
      ).toContain("sr-only");
      expect(screen.getByRole("tab", { name: "Convertidor" }).textContent).toBe("Convertidor");
      act(() =>
        resize?.([{ contentRect: { width: 1000 } }] as ResizeObserverEntry[], {} as ResizeObserver),
      );
      expect(
        screen.getByRole("tab", { name: "Notas" }).querySelector("[data-tab-name]")?.className,
      ).toBe("truncate");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(["darwin", "win32", "linux"])(
    "reserva controles desde el primer pintado en %s",
    (platform) => {
      renderBar({ ...makeBridge().bridge, platform });
      const header = screen.getByRole("banner");
      expect(header.classList.contains("ld-drag")).toBe(true);
      expect(header.style.paddingLeft).toBe(platform === "darwin" ? "96px" : "");
      expect(header.style.paddingRight).toBe(platform === "win32" ? "154px" : "");
      expect(header.style.height).toBe("52px");
      for (const item of [
        ...within(header).getAllByRole("button"),
        ...within(header).getAllByRole("tab"),
        ...within(header).queryAllByRole("link"),
      ]) {
        expect(item.closest(".ld-no-drag")).not.toBeNull();
      }
    },
  );

  it.each(["darwin", "win32", "linux"])(
    "el evento de pantalla completa actualiza la marca y las reservas en %s",
    (platform) => {
      const { bridge, listeners } = makeBridge();
      const unsubscribe = useShellStore.getState().subscribe(bridge);
      renderBar({ ...bridge, platform });
      expect(screen.getByText("LensDesk")).toBeTruthy();
      act(() => listeners.get("window.fullScreenChanged")?.({ fullScreen: true }));
      expect(useShellStore.getState().fullScreen).toBe(true);
      const brand = screen.getByText("LensSystems - LensDesk");
      expect(brand.classList.contains("truncate")).toBe(true);
      const header = screen.getByRole("banner");
      expect(header.style.paddingLeft).toBe("");
      expect(header.style.paddingRight).toBe("");
      act(() => listeners.get("window.fullScreenChanged")?.({ fullScreen: false }));
      expect(useShellStore.getState().fullScreen).toBe(false);
      expect(screen.getByText("LensDesk")).toBeTruthy();
      expect(header.style.paddingLeft).toBe(platform === "darwin" ? "96px" : "");
      expect(header.style.paddingRight).toBe(platform === "win32" ? "154px" : "");
      unsubscribe();
      expect(listeners.has("window.fullScreenChanged")).toBe(false);
    },
  );

  it("muestra el nombre localizado y cae al id sin manifiesto", async () => {
    renderBar(makeBridge().bridge);
    expect(screen.getByRole("tab", { name: "Notas" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "otra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar Notas" })).toBeTruthy();
    await act(() => rendererI18n.changeLanguage("en"));
    expect(screen.getByRole("tab", { name: "Notes" })).toBeTruthy();
  });

  it.each([
    [1280, 288, 1196, 296],
    [760, 128, 676, 136],
    [760, 48, 538, 230],
  ])(
    "reserva límites simétricos en una ventana de %i px",
    (width, brandRight, actionsLeft, inset) => {
      const rect = (left: number, right: number) =>
        ({ left, right, width: right - left }) as DOMRect;
      const geometry = vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          if (this.tagName === "HEADER") return rect(0, width);
          if (this.hasAttribute("data-brand")) return rect(0, brandRight);
          return rect(actionsLeft, width);
        });
      const styles = vi
        .spyOn(window, "getComputedStyle")
        .mockReturnValue({ columnGap: "8px" } as CSSStyleDeclaration);
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          disconnect() {}
        },
      );
      try {
        renderBar(makeBridge().bridge);
        const container = screen.getByRole("tablist").parentElement;
        expect(container).toHaveClass("absolute", "justify-center");
        expect(container?.style.left).toBe(`${inset}px`);
        expect(container?.style.right).toBe(`${inset}px`);
      } finally {
        geometry.mockRestore();
        styles.mockRestore();
        vi.unstubAllGlobals();
      }
    },
  );

  it("centra el contenido y superpone el cierre sin reservarle ancho, también en la activa", () => {
    renderBar(makeBridge().bridge);
    for (const name of ["Notas", "Convertidor"]) {
      const tab = screen.getByRole("tab", { name });
      expect(tab).toHaveClass("justify-center", "px-[21.5px]", "ld-no-drag");
      expect(tab.parentElement).toHaveClass("relative");
      expect(tab.firstElementChild).toHaveClass(
        "group-hover:-translate-x-[9.5px]",
        "group-has-[:focus-visible]:-translate-x-[9.5px]",
        "duration-[140ms]",
        "ease-out",
        "motion-reduce:transition-none",
      );
      expect(screen.getByRole("button", { name: `Cerrar ${name}` })).toHaveClass(
        "absolute",
        "right-[3px]",
        "size-6",
        "opacity-0",
      );
    }
  });

  it("sin pestañas no pinta la pista vacía", () => {
    render(
      <TooltipProvider>
        <TabBar bridge={makeBridge().bridge} tabs={[]} />
      </TooltipProvider>,
    );
    expect(screen.getByRole("tablist").className).not.toContain("bg-surface");
  });

  it("muestra la marca, el icono y un cierre separado de la pestaña", () => {
    renderBar(makeBridge().bridge);
    expect(screen.getByRole("banner").contains(screen.getByText("LensDesk"))).toBe(true);
    const tab = screen.getByRole("tab", { name: "Notas" });
    const icon = tab.querySelector("svg.lucide-sticky-note");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("width")).toBe("15");
    const close = screen.getByRole("button", { name: "Cerrar Notas" });
    expect(close.tagName).toBe("BUTTON");
    expect(tab.contains(close)).toBe(false);
    expect(close.closest('[role="tab"]')).toBeNull();
    expect(tab.parentElement?.contains(close)).toBe(true);
  });

  it("revela el cierre con hover o foco y lo conserva accesible y enfocable", () => {
    renderBar(makeBridge().bridge);
    const close = screen.getByRole("button", { name: "Cerrar Notas" });
    expect(close.tabIndex).toBe(0);
    expect(close.hasAttribute("disabled")).toBe(false);
    expect(close.parentElement?.classList.contains("group")).toBe(true);
    for (const name of [
      "opacity-0",
      "group-hover:opacity-100",
      "group-has-[:focus-visible]:opacity-100",
      "transition-opacity",
      "duration-[140ms]",
      "ease-out",
      "motion-reduce:transition-none",
    ])
      expect(close.classList.contains(name)).toBe(true);
    act(() => close.focus());
    expect(document.activeElement).toBe(close);
  });

  it("solo el botón central evita autoscroll y cierra sin activar", () => {
    const { bridge, invoke } = makeBridge();
    renderBar(bridge);
    const tab = screen.getByRole("tab", { name: "Notas" });
    for (const button of [0, 2]) {
      expect(fireEvent.mouseDown(tab, { button })).toBe(true);
      fireEvent(tab, new MouseEvent("auxclick", { button, bubbles: true }));
    }
    expect(invoke).not.toHaveBeenCalled();
    expect(fireEvent.mouseDown(tab, { button: 1 })).toBe(false);
    fireEvent(tab, new MouseEvent("auxclick", { button: 1, bubbles: true }));
    expect(invoke).toHaveBeenCalledExactlyOnceWith("tabs.close", { toolId: "notas" });
  });

  it("actualiza el nombre de la pestaña cuando cambia la lista de herramientas", async () => {
    const { bridge, listeners } = makeBridge();
    render(<App bridge={bridge} />);
    act(() =>
      useShellStore.setState({ tabs: [tabs[0] as (typeof tabs)[0]], tools: [], page: "tab" }),
    );
    expect(screen.getByRole("tab", { name: "notas" })).toBeTruthy();
    act(() =>
      listeners.get("tools.changed")?.({
        tools: [{ id: "notas", manifest: { name: { es: "Mis notas", en: "My notes" } } }],
        pendingDowngrade: null,
      }),
    );
    expect(screen.getByRole("tab", { name: "Mis notas" })).toBeTruthy();
  });

  it("la pestaña activa lleva tabIndex 0 aunque no sea la primera", () => {
    renderBar(makeBridge().bridge);
    expect(screen.getByRole("tab", { name: "Convertidor" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tab", { name: "Notas" }).getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tab", { name: "otra" }).getAttribute("tabindex")).toBe("-1");
  });

  it("vuelve a la pestaña activa al salir el foco de la barra", () => {
    render(
      <TooltipProvider>
        <TabBar bridge={makeBridge().bridge} tabs={tabs} />
        <button type="button">fuera</button>
      </TooltipProvider>,
    );
    const first = screen.getByRole("tab", { name: "Notas" });
    act(() => first.focus());
    expect(first.getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("tab", { name: "Convertidor" }).getAttribute("tabindex")).toBe("-1");
    fireEvent.blur(first, { relatedTarget: screen.getByRole("button", { name: "fuera" }) });
    expect(first.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tab", { name: "Convertidor" }).getAttribute("tabindex")).toBe("0");
  });

  it("las flechas, Inicio y Fin mueven el foco y el clic activa", () => {
    const { bridge } = makeBridge();
    renderBar(bridge);
    const [notas, conv, otra] = ["Notas", "Convertidor", "otra"].map((name) =>
      screen.getByRole("tab", { name }),
    ) as HTMLElement[];
    act(() => conv?.focus());
    fireEvent.keyDown(conv as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(otra);
    fireEvent.keyDown(otra as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(notas);
    fireEvent.keyDown(notas as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(otra);
    fireEvent.keyDown(otra as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(notas);
    fireEvent.keyDown(notas as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(otra);
    expect(bridge.invoke).not.toHaveBeenCalledWith("tabs.activate", expect.anything());
    fireEvent.click(otra as HTMLElement);
    expect(bridge.invoke).toHaveBeenCalledWith("tabs.activate", { toolId: "otra" });
  });
});

describe("aviso de actualización descartado", () => {
  beforeEach(async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      tabs: [],
      tools: [],
      page: "tools",
      update: null,
      dismissedVersion: null,
    });
  });
  afterEach(cleanup);

  it("guarda la versión al descartar y no vuelve a mostrar esa versión", async () => {
    const { bridge, listeners, invoke } = makeBridge();
    render(<App bridge={bridge} />);
    act(() => listeners.get("update.available")?.({ version: "2.0.0", html_url: "https://x.y" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar" }));
    expect(invoke).toHaveBeenCalledWith("settings.set", {
      key: "updates.dismissedVersion",
      value: "2.0.0",
    });
    act(() => listeners.get("update.available")?.({ version: "2.0.0", html_url: "https://x.y" }));
    expect(screen.queryByText("LensDesk 2.0.0 está disponible")).toBeNull();
    act(() => listeners.get("update.available")?.({ version: "2.1.0", html_url: "https://x.y" }));
    expect(await screen.findByText("LensDesk 2.1.0 está disponible")).toBeTruthy();
  });

  it("recuerda la versión descartada guardada al arrancar", async () => {
    const { bridge, listeners } = makeBridge("3.0.0");
    render(<App bridge={bridge} />);
    await waitFor(() => expect(useShellStore.getState().dismissedVersion).toBe("3.0.0"));
    act(() => listeners.get("update.available")?.({ version: "3.0.0", html_url: "https://x.y" }));
    expect(screen.queryByText("LensDesk 3.0.0 está disponible")).toBeNull();
    act(() => listeners.get("update.available")?.({ version: "3.0.1", html_url: "https://x.y" }));
    expect(await screen.findByText("LensDesk 3.0.1 está disponible")).toBeTruthy();
  });
});

describe("avisos dentro del encabezado", () => {
  afterEach(cleanup);
  it("el aviso de versión y los avisos viven dentro del header de la barra", async () => {
    await rendererI18n.changeLanguage("es");
    useShellStore.setState({
      tabs,
      tools,
      page: "tab",
      update: { version: "9.0.0", html_url: "https://x.y" },
      toasts: [{ id: 1, kind: "success", message: "Hecho" }],
    });
    render(<App bridge={makeBridge().bridge} />);
    const header = screen.getByRole("banner");
    expect(header.style.height).toBe(`${HEADER_HEIGHT}px`);
    for (const item of [
      ...within(header).getAllByRole("button"),
      ...within(header).queryAllByRole("tab"),
      ...within(header).queryAllByRole("link"),
    ]) {
      expect(item.closest(".ld-no-drag")).not.toBeNull();
    }
    expect(header.contains(screen.getByText("LensDesk 9.0.0 está disponible"))).toBe(true);
    expect(header.contains(screen.getByRole("button", { name: "Ir a Ajustes" }))).toBe(true);
    expect(header.contains(screen.getByText("Hecho"))).toBe(true);
    expect(header.contains(screen.getByRole("region", { name: /Notificaciones/ }))).toBe(true);
    useShellStore.setState({ update: null, toasts: [] });
  });
});

describe("mapa de iconos", () => {
  it("resuelve los iconos de las herramientas y cae a Puzzle", () => {
    expect(toolIcon("sticky-note")).toBe(StickyNote);
    expect(toolIcon("puzzle")).toBe(Puzzle);
    expect(toolIcon("file-output")).not.toBe(Puzzle);
    expect(toolIcon("no-existe")).toBe(Puzzle);
    expect(toolIcon("constructor")).toBe(Puzzle);
    expect(toolIcon(undefined)).toBe(Puzzle);
  });
});

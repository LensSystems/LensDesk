import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu.tsx";
import { IconButton } from "./IconButton.tsx";
import { Tooltip, TooltipProvider } from "./Tooltip.tsx";

Element.prototype.scrollIntoView = vi.fn();

describe("Tooltip", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aparece tras un retardo corto y se cierra con Escape", async () => {
    vi.useFakeTimers();
    render(
      <TooltipProvider>
        <Tooltip label="Ajustes">
          <button type="button">Abrir</button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Abrir" });
    fireEvent.pointerMove(trigger, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByRole("tooltip").textContent).toBe("Ajustes");
    await act(async () => undefined);
    fireEvent.keyDown(trigger, { key: "Escape" });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("cierra al salir del disparador y abre el siguiente sin retardo", () => {
    vi.useFakeTimers();
    render(
      <TooltipProvider>
        <Tooltip label="Ajustes" side="left">
          <button type="button">Configurar</button>
        </Tooltip>
        <Tooltip label="Herramientas">
          <button type="button">Explorar</button>
        </Tooltip>
      </TooltipProvider>,
    );
    const first = screen.getByRole("button", { name: "Configurar" });
    fireEvent.pointerMove(first, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip").textContent).toBe("Ajustes");
    fireEvent.pointerLeave(first, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerMove(screen.getByRole("button", { name: "Explorar" }), {
      pointerType: "mouse",
    });
    expect(screen.getByRole("tooltip").textContent).toBe("Herramientas");
  });

  it("desplaza la etiqueta vecina desde la última posición visible", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const left = this.textContent?.includes("Segunda") ? 180 : 100;
      return {
        left,
        top: 40,
        right: left + 60,
        bottom: 60,
        width: 60,
        height: 20,
        x: left,
        y: 40,
        toJSON() {},
      };
    });
    render(
      <TooltipProvider>
        <IconButton label="Primera">a</IconButton>
        <IconButton label="Segunda">b</IconButton>
      </TooltipProvider>,
    );
    const first = screen.getByRole("button", { name: "Primera" });
    fireEvent.pointerMove(first, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(150));
    await act(async () => undefined);
    fireEvent.pointerLeave(first, { pointerType: "mouse" });
    fireEvent.pointerMove(screen.getByRole("button", { name: "Segunda" }), {
      pointerType: "mouse",
    });
    await act(async () => undefined);
    const tip = document.querySelector<HTMLElement>(".ld-tooltip");
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(tip?.dataset.state).toBe("instant-open");
    expect(tip?.style.getPropertyValue("--ld-tooltip-x")).toBe("-80px");
    expect(tip?.dataset.travel).toBe("start");
    act(() => vi.advanceTimersByTime(20));
    expect(tip?.dataset.travel).toBe("end");
    fireEvent.pointerLeave(screen.getByRole("button", { name: "Segunda" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("no viaja entre etiquetas de filas distintas", async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top = this.textContent?.includes("Abajo") ? 240 : 40;
      return {
        left: 100,
        top,
        right: 160,
        bottom: top + 20,
        width: 60,
        height: 20,
        x: 100,
        y: top,
        toJSON() {},
      };
    });
    render(
      <TooltipProvider>
        <IconButton label="Arriba">a</IconButton>
        <IconButton label="Abajo">b</IconButton>
      </TooltipProvider>,
    );
    const first = screen.getByRole("button", { name: "Arriba" });
    fireEvent.pointerMove(first, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(150));
    await act(async () => undefined);
    fireEvent.pointerLeave(first, { pointerType: "mouse" });
    fireEvent.pointerMove(screen.getByRole("button", { name: "Abajo" }), {
      pointerType: "mouse",
    });
    await act(async () => undefined);
    const tip = document.querySelector<HTMLElement>(".ld-tooltip");
    expect(tip?.dataset.state).toBe("instant-open");
    expect(tip?.dataset.travel).toBeUndefined();
  });

  it.each(["mouseleave", "pointerleave", "blur"])("cierra con %s fuera de la ventana", (event) => {
    vi.useFakeTimers();
    render(
      <TooltipProvider>
        <IconButton label="Ajustes">x</IconButton>
      </TooltipProvider>,
    );
    fireEvent.pointerMove(screen.getByRole("button", { name: "Ajustes" }), {
      pointerType: "mouse",
    });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent(event === "blur" ? window : document.documentElement, new Event(event));
    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("una apertura pendiente no aparece si la ventana pierde el foco", () => {
    vi.useFakeTimers();
    render(
      <TooltipProvider>
        <IconButton label="Ajustes">x</IconButton>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Ajustes" });
    fireEvent.pointerMove(trigger, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));
    fireEvent(window, new Event("blur"));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    fireEvent(document.documentElement, new Event("pointerenter"));
    fireEvent.pointerMove(trigger, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("el primer foco tras perder la ventana muestra la etiqueta", () => {
    vi.useFakeTimers();
    render(
      <TooltipProvider>
        <IconButton label="Ajustes">x</IconButton>
      </TooltipProvider>,
    );
    fireEvent(window, new Event("blur"));
    act(() => screen.getByRole("button", { name: "Ajustes" }).focus());
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("IconButton usa su etiqueta como tooltip al enfocar", () => {
    render(
      <TooltipProvider>
        <IconButton label="Cerrar pestaña">x</IconButton>
      </TooltipProvider>,
    );
    act(() => screen.getByRole("button", { name: "Cerrar pestaña" }).focus());
    expect(screen.getByRole("tooltip").textContent).toBe("Cerrar pestaña");
    expect(
      screen.getByRole("button", { name: "Cerrar pestaña" }).getAttribute("aria-describedby"),
    ).toBeNull();
  });

  it("conserva una descripción explícita aunque el tooltip repita el nombre", () => {
    render(
      <TooltipProvider>
        <p id="help">Acción irreversible</p>
        <IconButton label="Quitar" aria-describedby="help">
          x
        </IconButton>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Quitar" });
    act(() => trigger.focus());
    expect(trigger.getAttribute("aria-describedby")).toBe("help");
  });

  it("IconButton sirve como trigger asChild de un menú", async () => {
    render(
      <TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Más acciones">x</IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Quitar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Más acciones" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Quitar" })).toBeTruthy());
  });
});

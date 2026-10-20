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
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole("tooltip").textContent).toBe("Ajustes");
    await act(async () => undefined);
    fireEvent.keyDown(trigger, { key: "Escape" });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
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

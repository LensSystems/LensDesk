import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./Dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select.tsx";
import { Tabs, TabsList, TabsTrigger } from "./Tabs.tsx";
import { Toast, ToastProvider, ToastViewport } from "./Toast.tsx";
import { UiLabelsProvider } from "./UiLabelsProvider.tsx";

Element.prototype.scrollIntoView = vi.fn();

describe("componentes superpuestos", () => {
  it("abre Dialog con foco, Escape lo cierra y devuelve el foco", async () => {
    render(
      <Dialog>
        <DialogTrigger> Abrir </DialogTrigger>
        <DialogContent>
          <DialogTitle>Diálogo</DialogTitle>
          <button type="button">Acción</button>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Acción" })).toBe(document.activeElement);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toBe(document.activeElement);
  });

  it("navega DropdownMenu con flechas reales y cierra con Escape", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Opciones</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Uno</DropdownMenuItem>
          <DropdownMenuItem>Dos</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Opciones" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const one = await screen.findByRole("menuitem", { name: "Uno" });
    expect(one).toBe(document.activeElement);
    fireEvent.keyDown(one, { key: "ArrowDown" });
    const two = screen.getByRole("menuitem", { name: "Dos" });
    await waitFor(() => expect(two).toBe(document.activeElement));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("selecciona con flechas y Enter y notifica el valor", async () => {
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Color">
          <SelectValue placeholder="Elige" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="azul">Azul</SelectItem>
          <SelectItem value="rojo">Rojo</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Color" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const blue = await screen.findByRole("option", { name: "Azul" });
    await waitFor(() => expect(blue).toBe(document.activeElement));
    fireEvent.keyDown(blue, { key: "ArrowDown" });
    const red = screen.getByRole("option", { name: "Rojo" });
    await waitFor(() => expect(red).toBe(document.activeElement));
    fireEvent.keyDown(red, { key: "Enter" });
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("rojo"));
  });

  it("mueve el foco entre pestañas con las flechas derecha e izquierda", async () => {
    render(
      <Tabs defaultValue="uno">
        <TabsList aria-label="Secciones">
          <TabsTrigger value="uno">Uno</TabsTrigger>
          <TabsTrigger value="dos">Dos</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const first = screen.getByRole("tab", { name: "Uno" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: "Dos" });
    await waitFor(() => expect(second).toBe(document.activeElement));
    fireEvent.keyDown(second, { key: "ArrowLeft" });
    await waitFor(() => expect(first).toBe(document.activeElement));
  });

  it("anuncia Toast y permite descartarlo con nombre accesible", async () => {
    function Example() {
      const [open, setOpen] = useState(true);
      return (
        <ToastProvider>
          <Toast open={open} onOpenChange={setOpen} title="Guardado" />
          <ToastViewport />
        </ToastProvider>
      );
    }
    render(
      <UiLabelsProvider labels={{ loading: "Cargando", close: "Cerrar", dismiss: "Descartar" }}>
        <Example />
      </UiLabelsProvider>,
    );
    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("assertive");
    const close = screen.getByRole("button", { name: "Descartar" });
    expect(close).toHaveClass("size-6", "rounded-full");
    expect(close.textContent).not.toContain("×");
    expect(close.querySelector("svg")).toHaveClass("lucide-x", "text-muted");
    expect(close.querySelector("svg")).toHaveAttribute("width", "14");
    expect(close.querySelector("svg")).toHaveAttribute("height", "14");
    expect(close.querySelector("svg")).toHaveAttribute("stroke-width", "2");
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});

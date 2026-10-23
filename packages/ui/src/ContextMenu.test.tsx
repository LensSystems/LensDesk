import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ContextMenu } from "./ContextMenu.tsx";

it("espera el menú nativo sin cancelar y permite abrirlo después", () => {
  let open: (point: { x: number; y: number }) => void = () => {};
  const native = vi.fn((_point, callback) => {
    open = callback;
  });
  render(
    <ContextMenu label="Insertar" items={[]} onNativeContextMenu={native}>
      <button type="button">Editor</button>
    </ContextMenu>,
  );
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 12,
    clientY: 34,
  });
  fireEvent(screen.getByRole("button"), event);
  expect(event.defaultPrevented).toBe(false);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(native).toHaveBeenCalledWith({ x: 12, y: 34 }, expect.any(Function));
  act(() => open({ x: 12, y: 34 }));
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(native).toHaveBeenCalledOnce();
});
it("Mayús+F10 abre directamente y muestra primero el grupo adicional", () => {
  const native = vi.fn();
  render(
    <ContextMenu
      label="Insertar"
      items={[{ label: "Encabezado", onSelect: vi.fn() }]}
      onNativeContextMenu={native}
      leadingGroup={{ label: "Ortografía", items: [{ label: "hola", onSelect: vi.fn() }] }}
    >
      <button type="button">Editor</button>
    </ContextMenu>,
  );
  fireEvent.keyDown(screen.getByRole("button"), { key: "F10", shiftKey: true });
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
    "hola",
    "Encabezado",
  ]);
  expect(native).not.toHaveBeenCalled();
});

it.each([{ key: "ContextMenu" }, { key: "F10", shiftKey: true }])(
  "abre con $key y navega a un submenú con flechas",
  async (key) => {
    render(
      <ContextMenu
        label="Editor"
        showLabel={false}
        items={[{ label: "Insertar", items: [{ label: "Tabla", onSelect: vi.fn() }] }]}
      >
        <button type="button">Editor</button>
      </ContextMenu>,
    );
    fireEvent.keyDown(screen.getByRole("button"), key);
    const trigger = screen.getByRole("menuitem", { name: "Insertar" });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    const item = screen.getByRole("menuitem", { name: "Tabla" });
    await vi.waitFor(() => expect(item).toHaveFocus());
    fireEvent.keyDown(item, { key: "ArrowLeft" });
    expect(screen.queryByRole("menuitem", { name: "Tabla" })).toBeNull();
    expect(trigger).toHaveFocus();
  },
);

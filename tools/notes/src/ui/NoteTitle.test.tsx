import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NoteTitle } from "./NoteTitle.tsx";

it("no admite cambios mientras el título se está guardando", async () => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  render(
    <TooltipProvider>
      <NoteTitle title="" onRename={() => pending} />
    </TooltipProvider>,
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Nuevo" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveAttribute("readonly");
  await act(async () => {
    finish();
    await pending;
  });
});

it("conserva el foco en el cuerpo mientras se guarda el título y vuelve a renderizarse", async () => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const rename = vi.fn(() => pending);
  const content = () => (
    <TooltipProvider>
      <NoteTitle title="" onRename={rename} />
      <textarea aria-label="Contenido" />
    </TooltipProvider>
  );
  const { container, rerender } = render(content());
  const title = container.querySelector("input");
  if (!title) throw new Error("Falta el título");
  const body = screen.getByRole("textbox", { name: "Contenido" });
  fireEvent.change(title, { target: { value: "Título nuevo" } });
  act(() => body.focus());
  expect(title).toHaveAttribute("readonly");
  expect(rename).toHaveBeenCalledWith("Título nuevo");
  expect(body).toHaveFocus();
  rerender(content());
  expect(body).toHaveFocus();
  await act(async () => {
    finish();
    await pending;
  });
  expect(body).toHaveFocus();
});

it("enfoca el título al abrir la edición y al volver a abrirla", () => {
  render(
    <TooltipProvider>
      <NoteTitle title="Nombre" onRename={vi.fn()} />
    </TooltipProvider>,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("textbox")).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("textbox")).toHaveFocus();
});

it("pulsar el lápiz durante un guardado que falla conserva el título escrito", async () => {
  let fail: () => void = () => {};
  const pending = new Promise<void>((_, reject) => {
    fail = () => reject(new Error("falló"));
  });
  render(
    <TooltipProvider>
      <NoteTitle title="" onRename={() => pending} />
    </TooltipProvider>,
  );
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Escrito" } });
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole("button"));
  await act(async () => {
    fail();
    await pending.catch(() => undefined);
  });
  expect(screen.getByRole("textbox")).toHaveValue("Escrito");
});

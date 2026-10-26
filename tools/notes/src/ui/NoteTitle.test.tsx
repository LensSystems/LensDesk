import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
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

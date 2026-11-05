import * as ui from "@lensdesk/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as icons from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Gallery } from "./Gallery.tsx";
import { SelectionExamples } from "./SelectionExamples.tsx";

Element.prototype.scrollIntoView = vi.fn();

describe("galería", () => {
  it("incluye cada componente público en ambos temas", () => {
    const { container } = render(<Gallery />);
    const iconExports = new Set<unknown>(Object.values(icons));
    const components = Object.entries(ui).filter(
      ([name, value]) =>
        name !== "cn" &&
        name !== "applyDocumentContext" &&
        name !== "trackInputModality" &&
        name !== "keyboardFocus" &&
        name !== "UiLabelsProvider" &&
        !iconExports.has(value) &&
        (typeof value === "function" ||
          (typeof value === "object" && value !== null && "$$typeof" in value)),
    );
    expect(components.length).toBeGreaterThan(0);
    for (const theme of ["light", "dark"]) {
      const column = container.querySelector(`[data-theme="${theme}"]`);
      for (const [name] of components) {
        expect(column?.querySelector(`[data-component="${name}"]`), name).toBeTruthy();
      }
    }
  });
});

it("consumidor genérico usa el default en normal/hover/foco/disabled/error/valor largo", async () => {
  render(<SelectionExamples />);
  const triggers = screen.getAllByRole("combobox");
  expect(triggers).toHaveLength(6);
  for (const trigger of triggers)
    expect(trigger.querySelector(".ld-select-chevron")).toHaveAttribute("focusable", "false");
  expect(screen.getByRole("combobox", { name: "Modo Deshabilitado" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Modo Error" })).toHaveAccessibleDescription(
    "Elige un modo disponible.",
  );
  expect(screen.getByRole("combobox", { name: "Modo Valor largo" })).toHaveTextContent(
    "Modo de lectura con un nombre de proyecto deliberadamente largo",
  );
  const trigger = screen.getByRole("combobox", { name: "Modo Normal" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const list = await screen.findByRole("listbox");
  expect(within(list).getByRole("option", { name: "Opción no disponible" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  fireEvent.keyDown(within(list).getByRole("option", { name: "Lectura" }), { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
});

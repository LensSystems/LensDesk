import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl.tsx";

it("reparte todo el ancho entre tres segmentos iguales y centrados con borde fino", () => {
  render(
    <SegmentedControl
      fullWidth
      aria-label="Vista"
      value="notes"
      onValueChange={vi.fn()}
      options={[
        { value: "notes", label: "Notas" },
        { value: "archive", label: "Archivadas" },
        { value: "trash", label: "Papelera" },
      ]}
    />,
  );
  expect(screen.getByRole("radiogroup")).toHaveClass("w-full", "border", "border-border");
  const segments = screen.getAllByRole("radio");
  expect(segments).toHaveLength(3);
  for (const segment of segments)
    expect(segment).toHaveClass("flex-1", "basis-0", "min-w-0", "text-center");
});

it("conserva el tamaño por contenido por defecto", () => {
  render(
    <SegmentedControl
      aria-label="Vista"
      value="notes"
      onValueChange={vi.fn()}
      options={[{ value: "notes", label: "Notas" }]}
    />,
  );
  expect(screen.getByRole("radiogroup")).not.toHaveClass("w-full");
  expect(screen.getByRole("radio")).not.toHaveClass("flex-1");
});

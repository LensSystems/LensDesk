import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Input } from "./Input.tsx";
import { ListItem } from "./ListItem.tsx";

it("la tarjeta contiene acciones fuera del botón principal y conserva selección y resumen", () => {
  const select = vi.fn();
  const action = vi.fn();
  render(
    <ListItem
      variant="card"
      title="Título"
      secondaryText="Resumen"
      selected
      onClick={select}
      actions={
        <button type="button" onClick={action}>
          Quitar
        </button>
      }
    />,
  );
  const main = screen.getByRole("button", { name: "Título" });
  const card = main.parentElement as HTMLElement;
  expect(card).toHaveClass("border-accent", "min-w-0");
  expect(main).toHaveAttribute("aria-current", "true");
  expect(within(main).getByText("Título")).toHaveClass("truncate");
  expect(within(main).getByText("Resumen")).toHaveClass("truncate");
  const remove = within(card).getByRole("button", { name: "Quitar" });
  expect(main.contains(remove)).toBe(false);
  fireEvent.click(remove);
  expect(action).toHaveBeenCalledOnce();
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(main);
  expect(select).toHaveBeenCalledOnce();
});

it("Input conserva etiqueta y error con un icono decorativo", () => {
  render(<Input label="Buscar" leadingIcon={<svg data-testid="icon" />} error="Obligatorio" />);
  const input = screen.getByRole("textbox", { name: "Buscar" });
  expect(input).toHaveClass("pl-9");
  expect(input).toHaveAccessibleDescription("Obligatorio");
  expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
});

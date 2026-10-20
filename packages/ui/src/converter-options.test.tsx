import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FileDropZone } from "./FileDropZone.tsx";
import { ListItem } from "./ListItem.tsx";

it("FileDropZone conserva tamaño y botón por defecto y permite una fila compacta primaria", () => {
  const browse = vi.fn();
  const { rerender } = render(
    <FileDropZone label="Soltar" buttonLabel="Elegir" onBrowse={browse} />,
  );
  expect(screen.getByRole("region")).toHaveClass("grid");
  expect(screen.getByRole("button")).toHaveClass("border-border-control");
  rerender(
    <FileDropZone
      size="compact"
      buttonVariant="primary"
      label="Soltar"
      buttonLabel="Elegir"
      onBrowse={browse}
    />,
  );
  expect(screen.getByRole("region")).toHaveClass("flex", "items-center");
  expect(screen.getByRole("button")).toHaveClass("bg-accent", "h-8");
  fireEvent.click(screen.getByRole("button"));
  expect(browse).toHaveBeenCalledOnce();
});

it("ListItem coloca el pie fuera del botón y permite personalizar el marco de tarjeta", () => {
  render(
    <ListItem
      variant="card"
      title="Archivo"
      containerClassName="border-danger"
      footer={<p>Detalle</p>}
    />,
  );
  const button = screen.getByRole("button", { name: "Archivo" });
  expect(button.parentElement).toHaveClass("border-danger");
  expect(within(button).queryByText("Detalle")).toBeNull();
  expect(screen.getByText("Detalle").parentElement).toHaveClass("col-span-2");
});

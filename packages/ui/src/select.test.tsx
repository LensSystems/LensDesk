import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select.tsx";

Element.prototype.scrollIntoView = vi.fn();

function Example({
  icon,
  disabled = false,
  invalid = false,
}: {
  icon?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <>
      <Select defaultValue="read" disabled={disabled}>
        <SelectTrigger
          aria-label="Modo"
          icon={icon}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? "error" : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="read">Lectura</SelectItem>
          <SelectItem value="edit">Edición</SelectItem>
        </SelectContent>
      </Select>
      {invalid && <p id="error">Elige un modo disponible.</p>}
    </>
  );
}

describe("indicador público de SelectTrigger", () => {
  it("el consumidor sin icon obtiene chevrón decorativo y preserva semántica/teclado", async () => {
    const change = vi.fn();
    render(
      <Select defaultValue="read" onValueChange={change}>
        <SelectTrigger aria-label="Modo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="read">Lectura</SelectItem>
          <SelectItem value="edit">Edición</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Modo" });
    const icon = trigger.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(trigger.textContent).not.toContain("⌄");
    expect(trigger.querySelectorAll("button,[tabindex='0']")).toHaveLength(0);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const read = await screen.findByRole("option", { name: "Lectura" });
    await waitFor(() => expect(read).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(read, { key: "ArrowDown" });
    const edit = screen.getByRole("option", { name: "Edición" });
    await waitFor(() => expect(edit).toHaveFocus());
    fireEvent.keyDown(edit, { key: "Enter" });
    await waitFor(() => expect(change).toHaveBeenCalledWith("edit"));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(trigger).toHaveTextContent("Edición");
  });
  it.each(["custom", "text", "null", "false", "empty", "zero", "undefined"])(
    "conserva icon=%s sin asChild ni aplicar rotación al custom",
    async (kind) => {
      const custom = (
        <svg data-testid="custom" aria-hidden="true">
          <title>Custom</title>
        </svg>
      );
      const icon =
        kind === "custom"
          ? custom
          : kind === "text"
            ? "x"
            : kind === "null"
              ? null
              : kind === "false"
                ? false
                : kind === "empty"
                  ? ""
                  : kind === "zero"
                    ? 0
                    : undefined;
      render(<Example icon={icon} />);
      const trigger = screen.getByRole("combobox", { name: "Modo" });
      expect(trigger.querySelectorAll(".ld-select-chevron")).toHaveLength(
        kind === "undefined" ? 1 : 0,
      );
      if (kind === "custom")
        expect(screen.getByTestId("custom")).not.toHaveClass("ld-select-chevron");
      if (kind === "text") expect(trigger).toHaveTextContent("x");
      expect(trigger.textContent).not.toMatch(/[▼⌄]/);
      if (kind === "null") {
        expect(trigger.querySelector("svg")).toBeNull();
        expect(trigger.children).toHaveLength(1);
      }
      if (kind === "zero") expect(trigger).toHaveTextContent("Lectura0");
      if (kind === "false" || kind === "empty") expect(trigger.textContent).toBe("Lectura");
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      const option = await screen.findByRole("option", { name: "Lectura" });
      fireEvent.keyDown(option, { key: "Escape" });
      await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );
  it.each(["popper", "item-aligned"] as const)(
    "respeta position=%s y callbacks Radix",
    async (position) => {
      const onEscape = vi.fn();
      render(
        <Select defaultValue="read">
          <SelectTrigger aria-label="Modo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position={position} sideOffset={12} onEscapeKeyDown={onEscape}>
            <SelectItem value="read">Lectura</SelectItem>
          </SelectContent>
        </Select>,
      );
      const trigger = screen.getByRole("combobox", { name: "Modo" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });
      const option = await screen.findByRole("option", { name: "Lectura" });
      expect(document.querySelector("[data-radix-popper-content-wrapper]") !== null).toBe(
        position === "popper",
      );
      fireEvent.keyDown(option, { key: "Escape" });
      await waitFor(() => expect(onEscape).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(trigger).toHaveFocus());
    },
  );
  it("preserva disabled/error y descripción sin añadir un control para el icono", () => {
    render(<Example disabled invalid />);
    const trigger = screen.getByRole("combobox", { name: "Modo" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAccessibleDescription("Elige un modo disponible.");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});

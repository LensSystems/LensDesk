import { readdirSync, readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.tsx";
import { Button } from "./Button.tsx";
import { Dialog, DialogContent, DialogTitle } from "./Dialog.tsx";
import { Notice } from "./Notice.tsx";

describe("estilos compartidos", () => {
  it.each([
    ["default", "border-border-control", "bg-surface-raised", "text-text"],
    [
      "primary",
      "border",
      "border-accent",
      "hover:border-accent-hover",
      "bg-accent",
      "hover:bg-accent-hover",
      "text-accent-fg",
    ],
    [
      "danger",
      "border",
      "border-danger",
      "hover:border-danger/90",
      "bg-danger",
      "hover:bg-danger/90",
      "text-danger-fg",
    ],
    ["ghost", "border-0", "bg-transparent", "text-text"],
  ] as const)("Button aplica la variante %s", (variant, ...classes) => {
    render(<Button variant={variant}>Acción</Button>);
    for (const name of classes)
      expect(screen.getByRole("button").classList.contains(name)).toBe(true);
  });

  it.each([
    ["md", "h-8", "text-[13px]"],
    ["lg", "h-9", "text-sm"],
  ] as const)("Button aplica el tamaño %s", (size, height, font) => {
    render(<Button size={size}>Acción</Button>);
    const classes = screen.getByRole("button").classList;
    for (const name of [height, font, "rounded-full"]) expect(classes.contains(name)).toBe(true);
  });

  it("Button conserva default y md como valores predeterminados", () => {
    const { container } = render(
      <>
        <Button>Implícito</Button>
        <Button variant="default" size="md">
          Explícito
        </Button>
      </>,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons[0]?.className).toBe(buttons[1]?.className);
  });

  it.each([
    ["neutral", "bg-surface", "text-muted"],
    ["accent", "bg-accent-soft", "text-accent-soft-fg"],
    ["success", "bg-success-soft", "text-success"],
    ["warning", "bg-warning-soft", "text-warning-soft-fg"],
    ["danger", "bg-danger-soft", "text-danger"],
  ] as const)("Badge aplica el tono %s", (tone, background, foreground) => {
    render(<Badge tone={tone}>Estado</Badge>);
    for (const name of [background, foreground, "rounded-full"])
      expect(screen.getByText("Estado").classList.contains(name)).toBe(true);
  });

  it("Badge conserva el significado de aviso por defecto", () => {
    render(<Badge>Sin firmar</Badge>);
    expect(screen.getByText("Sin firmar").classList.contains("bg-warning-soft")).toBe(true);
  });

  it.each([
    ["info", "bg-accent-soft"],
    ["success", "bg-success-soft"],
    ["warning", "bg-warning-soft"],
    ["danger", "bg-danger-soft"],
  ] as const)("Notice aplica el fondo suave %s", (tone, background) => {
    render(<Notice tone={tone} title="Aviso" />);
    expect(
      screen.getByText("Aviso").parentElement?.parentElement?.classList.contains(background),
    ).toBe(true);
  });

  it("las etiquetas y su contenedor no capturan el puntero", () => {
    const css = readFileSync(`${import.meta.dirname}/styles.css`, "utf8");
    expect(css).toMatch(
      /\[data-radix-popper-content-wrapper\]:has\(> \.ld-tooltip\),\s*\.ld-tooltip \{\s*pointer-events: none;/,
    );
  });

  it("el texto de Notice se puede seleccionar para copiar errores", () => {
    render(<Notice tone="danger" title="Falló la conversión" text="Detalle" />);
    expect(screen.getByText("Falló la conversión").parentElement).toHaveClass("ld-selectable");
  });

  const files = readdirSync(import.meta.dirname).filter(
    (name) => name.endsWith(".tsx") && !name.includes(".test."),
  );
  it.each(files)("%s conserva foco y movimiento reducido", (name) => {
    const source = readFileSync(`${import.meta.dirname}/${name}`, "utf8");
    for (const literal of source.matchAll(/"([^"\n]*)"/g)) {
      const classes = literal[1] ?? "";
      if (classes.includes("outline-none")) expect(classes).toContain("focus-visible:");
      if (/\btransition(?:-|\s)/.test(classes))
        expect(classes).toContain("motion-reduce:transition-none");
    }
  });

  it("el icono X de un diálogo lo cierra", async () => {
    function Example() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent closeLabel="Cerrar">
            <DialogTitle>Detalles</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Example />);
    const close = await screen.findByRole("button", { name: "Cerrar" });
    expect(close).toHaveClass("size-8", "rounded-full", "absolute", "right-2", "top-2");
    expect(close.textContent).not.toContain("×");
    expect(close.querySelector("svg")).toHaveAttribute("width", "16");
    expect(close.querySelector("svg")).toHaveAttribute("height", "16");
    expect(close.querySelector("svg")).toHaveAttribute("stroke-width", "2");
    expect(close.querySelector("svg")).toHaveClass("lucide-x", "text-muted");
    expect(close.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

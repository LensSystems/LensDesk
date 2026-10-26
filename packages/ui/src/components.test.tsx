import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button.tsx";
import { Checkbox } from "./Checkbox.tsx";
import { IconButton } from "./IconButton.tsx";
import { Input } from "./Input.tsx";
import { Switch } from "./Switch.tsx";
import { TooltipProvider } from "./Tooltip.tsx";
import { UiLabelsProvider } from "./UiLabelsProvider.tsx";

describe("componentes de formulario y estado", () => {
  it("expone el label del IconButton como nombre accesible", () => {
    render(
      <TooltipProvider>
        <IconButton label="Cerrar">x</IconButton>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
  });

  it.each([Checkbox, Switch])("cambia %s con Espacio y notifica una vez", (Control) => {
    const onCheckedChange = vi.fn();
    render(<Control aria-label="Activar" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole(Control === Switch ? "switch" : "checkbox", {
      name: "Activar",
    });
    control.focus();
    fireEvent.keyDown(control, { key: " ", code: "Space" });
    fireEvent.keyUp(control, { key: " ", code: "Space" });
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    if (Control === Switch) expect(control.getAttribute("aria-checked")).toBe("true");
    else expect((control as HTMLInputElement).checked).toBe(true);
  });

  it.each([Checkbox, Switch])("alterna %s con un click exactamente una vez", (Control) => {
    const onCheckedChange = vi.fn();
    render(<Control aria-label="Activar" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole(Control === Switch ? "switch" : "checkbox", {
      name: "Activar",
    });
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("usa el nombre de una etiqueta externa para el Switch", () => {
    render(
      <>
        <label htmlFor="developer-mode">Modo desarrollador</label>
        <Switch id="developer-mode" />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Modo desarrollador" })).toBeTruthy();
  });

  it.each([Checkbox, Switch])("mantiene un objetivo de puntero de 24px para %s", (Control) => {
    const { container } = render(<Control aria-label="Activar" />);
    expect((container.firstElementChild as HTMLInputElement).className).toContain("size-6");
  });

  it("asocia label, error y campo", () => {
    render(<Input error="Requerido" label="Nombre" />);
    const input = screen.getByLabelText("Nombre");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Requerido").id).toBe(input.getAttribute("aria-describedby"));
  });

  it("deshabilita el botón durante la carga y muestra progreso", () => {
    render(
      <UiLabelsProvider labels={{ loading: "Cargando", close: "Cerrar", dismiss: "Descartar" }}>
        <Button loading>Guardar</Button>
      </UiLabelsProvider>,
    );
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("progressbar", { name: "Cargando" })).toBeTruthy();
  });
});

function motionPreference(allowed: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: allowed } as MediaQueryList));
}

describe("dibujo de la palomita", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("se habilita solo al marcar, nunca al montarla marcada ni al desmarcar", () => {
    motionPreference(true);
    const { rerender } = render(<Checkbox aria-label="Datos" defaultChecked />);
    const control = screen.getByRole("checkbox", { name: "Datos" });
    expect(control.getAttribute("data-motion")).toBeNull();
    fireEvent.click(control);
    expect(control.getAttribute("data-motion")).toBeNull();
    fireEvent.click(control);
    expect(control.getAttribute("data-motion")).toBe("on");
    rerender(<Checkbox aria-label="Datos" checked={false} />);
    expect(control.getAttribute("data-motion")).toBeNull();
  });

  it("se habilita cuando el estado controlado cambia desde fuera y se apaga al terminar", () => {
    motionPreference(true);
    const { rerender } = render(<Checkbox aria-label="Datos" checked={false} />);
    const control = screen.getByRole("checkbox", { name: "Datos" });
    rerender(<Checkbox aria-label="Datos" checked />);
    expect(control.getAttribute("data-motion")).toBe("on");
    // jsdom no tiene AnimationEvent: React escucha aquí el nombre con prefijo.
    fireEvent(control, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(control.getAttribute("data-motion")).toBeNull();
  });

  it("no se habilita con reducir movimiento", () => {
    motionPreference(false);
    render(<Checkbox aria-label="Datos" />);
    const control = screen.getByRole("checkbox", { name: "Datos" });
    fireEvent.click(control);
    expect(control).toBeChecked();
    expect(control.getAttribute("data-motion")).toBeNull();
  });
});

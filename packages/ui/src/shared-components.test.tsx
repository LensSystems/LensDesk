import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { FileDropZone } from "./FileDropZone.tsx";
import { ListItem } from "./ListItem.tsx";
import { MarkdownView } from "./MarkdownView.tsx";
import { Notice } from "./Notice.tsx";
import { Panel } from "./Panel.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { UiLabelsProvider } from "./UiLabelsProvider.tsx";

describe("componentes compartidos", () => {
  it("SegmentedControl selecciona, enfoca, salta deshabilitados y recorre los extremos", async () => {
    const change = vi.fn();
    function Example() {
      const [value, setValue] = useState("a");
      return (
        <SegmentedControl
          aria-label="Vista"
          value={value}
          onValueChange={(next) => {
            change(next);
            setValue(next);
          }}
          options={[
            { value: "a", label: "Uno" },
            { value: "b", label: "Dos", disabled: true },
            { value: "c", label: "Tres" },
            { value: "d", label: "Cuatro" },
          ]}
        />
      );
    }
    render(<Example />);
    expect(screen.getByRole("radiogroup", { name: "Vista" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
    radios[0]?.focus();
    for (const [key, index] of [
      ["ArrowRight", 2],
      ["ArrowDown", 3],
      ["ArrowRight", 0],
      ["ArrowLeft", 3],
      ["ArrowUp", 2],
      ["Home", 0],
      ["End", 3],
    ] as const) {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key });
      await waitFor(() => expect(document.activeElement).toBe(radios[index]));
      expect(radios[index]?.getAttribute("aria-checked")).toBe("true");
      expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([radios[index]]);
    }
    expect(change).toHaveBeenLastCalledWith("d");
  });

  it.each(["Escape", "Cancelar", "Confirmar"])(
    "ConfirmDialog: %s y retorno del foco",
    async (action) => {
      const confirm = vi.fn();
      function Example() {
        const [open, setOpen] = useState(false);
        return (
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Eliminar"
            description="¿Continuar?"
            confirmLabel="Confirmar"
            cancelLabel="Cancelar"
            onConfirm={() => {
              confirm();
              setOpen(false);
            }}
          >
            <button type="button">Abrir</button>
          </ConfirmDialog>
        );
      }
      render(<Example />);
      const trigger = screen.getByRole("button", { name: "Abrir" });
      trigger.focus();
      fireEvent.click(trigger);
      await screen.findByRole("dialog", { name: "Eliminar" });
      if (action === "Escape")
        fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
      else fireEvent.click(screen.getAllByRole("button", { name: action })[0] as HTMLElement);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(confirm).toHaveBeenCalledTimes(action === "Confirmar" ? 1 : 0);
    },
  );

  it.each(["default", "danger"] as const)(
    "ConfirmDialog enfoca cancelar en tono %s y distingue el cierre",
    async (tone) => {
      render(
        <UiLabelsProvider labels={{ close: "Cerrar", loading: "Cargando", dismiss: "Descartar" }}>
          <ConfirmDialog
            open
            onOpenChange={() => undefined}
            title="Eliminar"
            description="¿Continuar?"
            confirmLabel="Confirmar"
            cancelLabel="Cancelar"
            onConfirm={vi.fn()}
            tone={tone}
          />
        </UiLabelsProvider>,
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancelar" })),
      );
      expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Cerrar" }).textContent).toBe("×");
    },
  );

  it("ConfirmDialog solo se abre cuando open es true", () => {
    const props = {
      title: "Eliminar",
      description: "¿Continuar?",
      confirmLabel: "Confirmar",
      cancelLabel: "Cancelar",
      onConfirm: vi.fn(),
      onOpenChange: vi.fn(),
    };
    const { rerender } = render(<ConfirmDialog {...props} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<ConfirmDialog {...props} open />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("ConfirmDialog bloquea la confirmación durante busy", () => {
    const confirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Eliminar"
        description="Espera"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        busy
        onConfirm={confirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["info", "success", "warning", "danger"] as const)(
    "Notice usa el rol de %s y ejecuta la acción",
    (tone) => {
      const action = vi.fn();
      render(
        <Notice
          tone={tone}
          title="Aviso"
          text="Detalle"
          action={{ label: "Reintentar", onClick: action }}
        />,
      );
      expect(
        screen.getByRole(tone === "info" || tone === "success" ? "status" : "alert").textContent,
      ).toContain("Detalle");
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      expect(action).toHaveBeenCalledOnce();
    },
  );

  it("MarkdownView monta HTML saneado y tiene reglas para su contenido", () => {
    const { container, rerender } = render(
      <MarkdownView html="<h1>Título</h1><ul><li>Elemento</li></ul><ol><li>Otro</li></ol><pre><code>valor</code></pre><table><tbody><tr><td>Dato</td></tr></tbody></table>" />,
    );
    const article = container.querySelector(".ld-markdown-view");
    for (const selector of ["h1", "ul", "ol", "pre", "code", "table"])
      expect(article?.querySelector(selector)).toBeTruthy();
    const css = readFileSync("packages/ui/src/styles.css", "utf8");
    for (const selector of ["h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "pre", "code", "table"])
      expect(css).toContain(`.ld-markdown-view ${selector}`);
    rerender(<MarkdownView html="<h2>Nuevo</h2>" />);
    expect(screen.getByRole("heading", { name: "Nuevo" })).toBeTruthy();
    expect(screen.queryByText("Título")).toBeNull();
  });

  it("FileDropZone entrega solo File, aplica filtros y muestra el arrastre", () => {
    const onFiles = vi.fn();
    render(
      <FileDropZone label="Soltar" buttonLabel="Elegir" accept=".csv" multiple onFiles={onFiles} />,
    );
    const zone = screen.getByRole("region", { name: "Soltar" });
    const files = [new File(["a"], "uno.csv"), new File(["b"], "dos.csv")];
    fireEvent.dragEnter(zone);
    expect(zone.getAttribute("data-dragging")).toBe("true");
    fireEvent.drop(zone, { dataTransfer: { files: [...files, new File(["x"], "otro.txt")] } });
    expect(onFiles).toHaveBeenCalledWith(files);
    expect(zone.getAttribute("data-dragging")).toBe("false");
    for (const file of onFiles.mock.calls[0]?.[0] ?? []) {
      expect(file).toBeInstanceOf(File);
      expect("path" in file).toBe(false);
    }
    const button = screen.getByRole("button", { name: "Elegir" });
    button.focus();
    expect(button.tabIndex).toBe(0);
    expect(document.activeElement).toBe(button);
  });

  it("FileDropZone ignora archivos deshabilitado y permite elegir repetidamente", () => {
    const onFiles = vi.fn();
    const { container, rerender } = render(
      <FileDropZone label="Soltar" buttonLabel="Elegir" disabled onFiles={onFiles} />,
    );
    const files = [new File(["a"], "uno.csv"), new File(["b"], "dos.csv")];
    fireEvent.drop(screen.getByRole("region"), { dataTransfer: { files } });
    expect(onFiles).not.toHaveBeenCalled();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    rerender(<FileDropZone label="Soltar" buttonLabel="Elegir" onFiles={onFiles} />);
    const input = container.querySelector("input") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button"));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { files } });
    expect(onFiles).toHaveBeenCalledWith([files[0]]);
    expect(input.value).toBe("");
  });

  it("Panel, Toolbar y ListItem exponen nombre, rol y selección", () => {
    render(
      <Panel title="Panel" actions={<button type="button">Acción</button>}>
        <Toolbar aria-label="Controles">
          <button type="button">Guardar</button>
        </Toolbar>
        <nav aria-label="Lista">
          <ListItem
            title="Elemento"
            secondaryText="Detalle"
            selected
            actions={<button type="button">Quitar</button>}
          />
        </nav>
      </Panel>,
    );
    expect(screen.getByRole("region", { name: "Panel" })).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: "Controles" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Elemento Detalle" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Quitar" }).closest("button")?.textContent).toBe(
      "Quitar",
    );
  });
});

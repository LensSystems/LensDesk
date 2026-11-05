import * as ui from "@lensdesk/ui";
import { useId } from "react";
import { Example } from "./Example.tsx";

export function SelectionExamples() {
  const id = useId();
  return (
    <>
      <Example
        names={[
          "Select",
          "SelectTrigger",
          "SelectValue",
          "SelectContent",
          "SelectGroup",
          "SelectLabel",
          "SelectItem",
          "SelectSeparator",
        ]}
      >
        <div className="gallery-states">
          {["Normal", "Hover simulado", "Foco", "Deshabilitado", "Error", "Valor largo"].map(
            (state) => (
              <div key={state}>
                <h4>{state}</h4>
                <ui.Select
                  defaultValue={state === "Valor largo" ? "long" : "read"}
                  disabled={state === "Deshabilitado"}
                >
                  <ui.SelectTrigger
                    aria-label={`Modo ${state}`}
                    aria-invalid={state === "Error" || undefined}
                    aria-describedby={state === "Error" ? `${id}-error` : undefined}
                    data-gallery-state={state}
                    className="w-44"
                  >
                    <ui.SelectValue />
                  </ui.SelectTrigger>
                  <ui.SelectContent>
                    <ui.SelectGroup>
                      <ui.SelectLabel>Modo del proyecto</ui.SelectLabel>
                      <ui.SelectItem value="read">Lectura</ui.SelectItem>
                      <ui.SelectItem value="edit">Edición</ui.SelectItem>
                      <ui.SelectItem value="long">
                        Modo de lectura con un nombre de proyecto deliberadamente largo
                      </ui.SelectItem>
                      <ui.SelectSeparator />
                      <ui.SelectItem value="disabled" disabled>
                        Opción no disponible
                      </ui.SelectItem>
                    </ui.SelectGroup>
                  </ui.SelectContent>
                </ui.Select>
                {state === "Error" && (
                  <p id={`${id}-error`} className="mt-1 text-xs text-danger">
                    Elige un modo disponible.
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      </Example>
      <Example names={["Tabs", "TabsList", "TabsTrigger", "TabsContent"]}>
        <ui.Tabs defaultValue="normal">
          <ui.TabsList aria-label="Ejemplos">
            {["Normal", "Hover simulado", "Foco", "Deshabilitado"].map((state) => (
              <ui.TabsTrigger
                key={state}
                value={state === "Normal" ? "normal" : state}
                data-gallery-state={state}
                disabled={state === "Deshabilitado"}
              >
                {state}
              </ui.TabsTrigger>
            ))}
          </ui.TabsList>
          <ui.TabsContent value="normal">Contenido de la pestaña activa</ui.TabsContent>
        </ui.Tabs>
      </Example>
    </>
  );
}

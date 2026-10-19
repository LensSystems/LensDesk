import * as ui from "@lensdesk/ui";
import { Example } from "./Example.tsx";

export function SelectionExamples() {
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
          {["Normal", "Hover simulado", "Foco", "Deshabilitado"].map((state) => (
            <div key={state}>
              <h4>{state}</h4>
              <ui.Select defaultValue="es" disabled={state === "Deshabilitado"}>
                <ui.SelectTrigger aria-label="Idioma" data-gallery-state={state}>
                  <ui.SelectValue />
                </ui.SelectTrigger>
                <ui.SelectContent>
                  <ui.SelectGroup>
                    <ui.SelectLabel>Idiomas</ui.SelectLabel>
                    <ui.SelectItem value="es">Español</ui.SelectItem>
                    <ui.SelectItem value="en">Inglés</ui.SelectItem>
                    <ui.SelectSeparator />
                    <ui.SelectItem value="fr" disabled>
                      Francés (no disponible)
                    </ui.SelectItem>
                  </ui.SelectGroup>
                </ui.SelectContent>
              </ui.Select>
            </div>
          ))}
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

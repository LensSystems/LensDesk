import * as ui from "@lensdesk/ui";
import { useState } from "react";
import { Example } from "./Example.tsx";

export function OverlayExamples() {
  const [toast, setToast] = useState(false);
  return (
    <>
      <Example
        names={[
          "Dialog",
          "DialogTrigger",
          "DialogContent",
          "DialogTitle",
          "DialogDescription",
          "DialogClose",
        ]}
      >
        {["Normal", "Hover simulado", "Foco", "Deshabilitado"].map((state) => (
          <ui.Dialog key={state}>
            <ui.DialogTrigger asChild>
              <ui.Button data-gallery-state={state} disabled={state === "Deshabilitado"}>
                Abrir diálogo · {state}
              </ui.Button>
            </ui.DialogTrigger>
            <ui.DialogContent>
              <ui.DialogTitle>Confirmar cambios</ui.DialogTitle>
              <ui.DialogDescription>Revisa los datos antes de guardar.</ui.DialogDescription>
              <ui.DialogClose asChild>
                <ui.Button variant="primary" size="lg">
                  Entendido
                </ui.Button>
              </ui.DialogClose>
            </ui.DialogContent>
          </ui.Dialog>
        ))}
      </Example>
      <Example
        names={[
          "DropdownMenu",
          "DropdownMenuTrigger",
          "DropdownMenuContent",
          "DropdownMenuItem",
          "DropdownMenuCheckboxItem",
          "DropdownMenuRadioGroup",
          "DropdownMenuRadioItem",
          "DropdownMenuLabel",
          "DropdownMenuSeparator",
        ]}
      >
        {["Normal", "Hover simulado", "Foco", "Deshabilitado"].map((state) => (
          <ui.DropdownMenu key={state}>
            <ui.DropdownMenuTrigger asChild>
              <ui.Button data-gallery-state={state} disabled={state === "Deshabilitado"}>
                Abrir menú · {state}
              </ui.Button>
            </ui.DropdownMenuTrigger>
            <ui.DropdownMenuContent>
              <ui.DropdownMenuLabel>Opciones</ui.DropdownMenuLabel>
              <ui.DropdownMenuItem>Normal</ui.DropdownMenuItem>
              <ui.DropdownMenuItem destructive>Eliminar</ui.DropdownMenuItem>
              <ui.DropdownMenuItem data-gallery-state="Hover simulado">
                Hover simulado
              </ui.DropdownMenuItem>
              <ui.DropdownMenuItem data-gallery-state="Foco">Foco</ui.DropdownMenuItem>
              <ui.DropdownMenuItem disabled>Deshabilitado</ui.DropdownMenuItem>
              <ui.DropdownMenuSeparator />
              <ui.DropdownMenuCheckboxItem checked>Mostrar detalles</ui.DropdownMenuCheckboxItem>
              <ui.DropdownMenuRadioGroup value="local">
                <ui.DropdownMenuRadioItem value="local">Local</ui.DropdownMenuRadioItem>
                <ui.DropdownMenuRadioItem value="otro" disabled>
                  No disponible
                </ui.DropdownMenuRadioItem>
              </ui.DropdownMenuRadioGroup>
            </ui.DropdownMenuContent>
          </ui.DropdownMenu>
        ))}
      </Example>
      <Example names={["Tooltip", "TooltipProvider"]}>
        <ui.Tooltip label="Información adicional">
          <ui.Button>Pasa el puntero o enfoca</ui.Button>
        </ui.Tooltip>
      </Example>
      <Example names={["Toast", "ToastProvider", "ToastViewport"]}>
        <ui.ToastProvider duration={100000}>
          <ui.Button onClick={() => setToast(true)}>Mostrar aviso</ui.Button>
          <ui.Toast
            open={toast}
            onOpenChange={setToast}
            title="Cambios guardados"
            description="Los datos están disponibles localmente."
          />
          <ui.ToastViewport />
        </ui.ToastProvider>
      </Example>
    </>
  );
}

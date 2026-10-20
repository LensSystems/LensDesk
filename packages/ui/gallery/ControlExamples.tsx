import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  Plus,
  Progress,
  Switch,
} from "@lensdesk/ui";
import { Example } from "./Example.tsx";

const states = ["Normal", "Hover simulado", "Foco", "Deshabilitado", "Error"] as const;

export function ControlExamples() {
  return (
    <>
      {(["Button", "IconButton", "Input", "Checkbox", "Switch"] as const).map((name) => (
        <Example key={name} names={[name]}>
          <div className="gallery-states">
            {states
              .filter((state) => state !== "Error" || name === "Input")
              .map((state) => {
                const props = { disabled: state === "Deshabilitado", "data-gallery-state": state };
                return (
                  <div key={state}>
                    <h4>{state}</h4>
                    {name === "Button" && <Button {...props}>Guardar</Button>}
                    {name === "IconButton" && (
                      <IconButton {...props} label="Añadir">
                        <Plus size={16} />
                      </IconButton>
                    )}
                    {name === "Input" && (
                      <Input
                        {...props}
                        label="Nombre"
                        placeholder="Escribe un nombre"
                        error={state === "Error" ? "El nombre es obligatorio" : undefined}
                      />
                    )}
                    {name === "Checkbox" && (
                      <>
                        <Checkbox {...props} aria-label="Activar opción" />
                        <Checkbox {...props} defaultChecked aria-label="Opción activada" />
                      </>
                    )}
                    {name === "Switch" && (
                      <>
                        <Switch {...props} aria-label="Activar ajuste" />
                        <Switch {...props} defaultChecked aria-label="Ajuste activado" />
                      </>
                    )}
                  </div>
                );
              })}
          </div>
          {name === "Button" && (
            <>
              <Button loading>Guardando</Button>
              {(["default", "primary", "danger", "ghost"] as const).map((variant) =>
                (["md", "lg"] as const).map((size) => (
                  <Button key={`${variant}-${size}`} variant={variant} size={size}>
                    {variant} · {size}
                  </Button>
                )),
              )}
            </>
          )}
        </Example>
      ))}
      <Example names={["Badge"]}>
        <Badge>Sin firmar</Badge>
        {(["neutral", "accent", "success", "warning", "danger"] as const).map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Example>
      <Example names={["Progress"]}>
        <Progress />
      </Example>
      <Example names={["EmptyState"]}>
        <EmptyState
          title="Sin resultados"
          description="Añade el primer elemento."
          action={<Button>Añadir</Button>}
        />
      </Example>
    </>
  );
}

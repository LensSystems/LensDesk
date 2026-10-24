import {
  BrushCleaning,
  Button,
  ConfirmDialog,
  FileDropZone,
  ListItem,
  MarkdownRaw,
  MarkdownView,
  Notice,
  Panel,
  Save,
  SaveAll,
  SaveMarkdown,
  SegmentedControl,
  Toolbar,
} from "@lensdesk/ui";
import { useState } from "react";
import { Example } from "./Example.tsx";

export function SharedExamples() {
  const [value, setValue] = useState("edit");
  const [dialog, setDialog] = useState<string | null>(null);
  const [files, setFiles] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <>
      <Example names={["BrushCleaning", "Save", "MarkdownRaw", "SaveMarkdown", "SaveAll"]}>
        <MarkdownRaw aria-label="Markdown crudo" />
        <SaveMarkdown aria-label="Guardar .md" />
        <SaveMarkdown chip aria-label="Guardar .md con insignia" />
        <SaveAll size={16} aria-label="Guardar todos" />
        <BrushCleaning aria-label="Borrar historial" />
        <Save aria-label="Guardar" />
      </Example>
      <Example names={["Panel"]}>
        <Panel title="Panel" actions={<Button>Acción</Button>}>
          Contenido
        </Panel>
        <Panel>Sin encabezado</Panel>
      </Example>
      <Example names={["Toolbar"]}>
        <Toolbar aria-label="Edición">
          <Button>Guardar</Button>
          <Button disabled>Exportar</Button>
        </Toolbar>
      </Example>
      <Example names={["SegmentedControl"]}>
        <SegmentedControl
          aria-label="Vista"
          value={value}
          onValueChange={setValue}
          options={[
            { value: "edit", label: "Editar" },
            { value: "disabled", label: "No disponible", disabled: true },
            { value: "preview", label: "Vista previa" },
          ]}
        />
      </Example>
      <Example names={["SegmentedControl"]}>
        <SegmentedControl
          fullWidth
          aria-label="Vista a todo el ancho"
          value={value}
          onValueChange={setValue}
          options={[
            { value: "edit", label: "Editar" },
            { value: "preview", label: "Vista previa" },
            { value: "other", label: "Otra vista" },
          ]}
        />
      </Example>
      <Example names={["Notice"]}>
        {(["info", "success", "warning", "danger"] as const).map((tone) => (
          <Notice
            key={tone}
            tone={tone}
            title={tone}
            text={notice || "Mensaje del aviso"}
            action={{ label: "Acción", onClick: () => setNotice("Acción ejecutada") }}
          />
        ))}
      </Example>
      <Example names={["ConfirmDialog"]}>
        {(["default", "danger", "busy"] as const).map((state) => (
          <ConfirmDialog
            key={state}
            open={dialog === state}
            onOpenChange={(open) => setDialog(open ? state : null)}
            title="Confirmar cambios"
            description="Revisa los datos antes de continuar."
            confirmLabel="Confirmar"
            cancelLabel="Cancelar"
            onConfirm={() => setDialog(null)}
            tone={state === "danger" ? "danger" : "default"}
            busy={state === "busy"}
          >
            <Button>Abrir · {state}</Button>
          </ConfirmDialog>
        ))}
      </Example>
      <Example names={["ListItem"]}>
        <nav aria-label="Elementos">
          <ListItem
            title="Seleccionado"
            secondaryText="Texto secundario"
            selected
            actions={<Button>Acción</Button>}
          />
          <ListItem
            variant="card"
            footer="Detalle de la tarjeta"
            containerClassName="border-danger"
            title="Tarjeta"
            secondaryText="Resumen"
            selected
            actions={<Button>Acción de tarjeta</Button>}
          />
          <ListItem
            variant="card"
            aria-label="Ideas para el sprint"
            title={
              <>
                Ideas para el{" "}
                <mark className="rounded-ld-sm bg-accent-soft px-0.5 text-accent-soft-fg">
                  sprint
                </mark>
              </>
            }
            secondaryText={
              <>
                Preparar el{" "}
                <mark className="rounded-ld-sm bg-accent-soft px-0.5 text-accent-soft-fg">
                  sprint
                </mark>
              </>
            }
          />
          <ListItem title="Normal" />
          <ListItem title="Deshabilitado" disabled />
        </nav>
      </Example>
      <Example names={["MarkdownView"]}>
        <MarkdownView
          html={
            '<h1>Título</h1><h2>Subtítulo</h2><p>Párrafo con <a href="#">enlace</a> y <code>código</code>.</p><ul><li>Viñeta</li></ul><ol><li>Ordenada</li></ol><pre><code>const valor = 1;</code></pre><blockquote>Cita</blockquote><table><thead><tr><th>Columna</th></tr></thead><tbody><tr><td>Dato</td></tr></tbody></table><hr>'
          }
        />
      </Example>
      <Example names={["FileDropZone"]}>
        <FileDropZone
          size="compact"
          buttonVariant="primary"
          label="Arrastra más documentos a esta zona"
          buttonLabel="Elegir archivos"
          onBrowse={() => setNotice("Selector solicitado")}
        />
        <FileDropZone
          label="Suelta archivos"
          buttonLabel="Elegir archivos"
          description={files || "Archivos HTML y CSV"}
          accept=".html,.csv"
          multiple
          onFiles={(items) => setFiles(items.map((file) => file.name).join(", "))}
        />
        <FileDropZone
          label="Elegir mediante la aplicación"
          buttonLabel="Abrir selector"
          description={notice || "La aplicación gestiona los archivos"}
          onBrowse={() => setNotice("Selector solicitado")}
        />
        <FileDropZone
          label="No disponible"
          buttonLabel="Elegir archivos"
          disabled
          onFiles={() => undefined}
        />
      </Example>
    </>
  );
}

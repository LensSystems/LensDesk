import { history } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { EditorMenu } from "./EditorMenu.tsx";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key
        .split(".")
        .reduce<unknown>(
          (value, part) =>
            typeof value === "object" && value !== null
              ? (value as Record<string, unknown>)[part]
              : undefined,
          es,
        ) ?? key,
  }),
}));
let editor: EditorView;
afterEach(() => editor?.destroy());
function setup(privateNote = false, readOnly = false) {
  editor = new EditorView({
    state: EditorState.create({
      doc: "texto",
      selection: { anchor: 0, head: 5 },
      extensions: [history(), EditorState.readOnly.of(readOnly)],
    }),
  });
  render(
    <EditorMenu view={{ current: editor }} privateNote={privateNote} readOnly={readOnly}>
      <button type="button">Editor</button>
    </EditorMenu>,
  );
  fireEvent.contextMenu(screen.getByRole("button"));
}
function insert() {
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Insertar" }), {
    key: "ArrowRight",
  });
  return screen.getByRole("menu", { name: "Insertar" });
}
it("ordena el menú principal y los grupos de Insertar", () => {
  setup();
  expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
    expect.stringMatching(/^Deshacer/),
    expect.stringMatching(/^Rehacer/),
    expect.stringMatching(/Formato/),
    expect.stringMatching(/^Insertar/),
  ]);
  expect(screen.getAllByRole("separator")).toHaveLength(1);
  expect(screen.getByRole("menu")).toHaveClass("min-w-[264px]");
  const menu = insert();
  expect(menu).toHaveClass("min-w-[294px]");
  expect(
    within(menu)
      .getAllByRole("menuitem")
      .map(
        (item) =>
          item.querySelector("span:nth-child(2)")?.textContent +
          (item.getAttribute("aria-description") ?? ""),
      ),
  ).toEqual([
    "Encabezado 1",
    "Encabezado 2",
    "Encabezado 3",
    "Lista con viñetas",
    "Lista numerada",
    "Lista de tareas",
    "Cita",
    "Bloque de código",
    "Tabla",
    "Separador",
    "Enlace…",
    "Contraseña…solo privadas",
  ]);
  expect(within(menu).getAllByRole("separator")).toHaveLength(3);
  expect(within(menu).getByRole("menuitem", { name: "Contraseña…" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});
it.each([
  ["Encabezado 1", "# texto"],
  ["Encabezado 2", "## texto"],
  ["Encabezado 3", "### texto"],
  ["Lista con viñetas", "- texto"],
  ["Lista numerada", "1. texto"],
  ["Lista de tareas", "- [ ] texto"],
  ["Cita", "> texto"],
  ["Bloque de código", "```\ntexto\n```\n\n"],
  ["Tabla", "texto\n\n|  |  |\n| --- | --- |\n|  |  |\n|  |  |\n\n"],
  ["Separador", "texto\n\n---\n\n"],
  ["Enlace…", "[texto](url)"],
])("inserta %s desde el submenú", (label, expected) => {
  setup();
  fireEvent.click(within(insert()).getByRole("menuitem", { name: label }));
  expect(editor.state.doc.toString()).toBe(expected);
});
it("abre el diálogo de contraseña en notas privadas", () => {
  setup(true);
  fireEvent.click(within(insert()).getByRole("menuitem", { name: "Contraseña…" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
});
it("deshabilita las inserciones y el formato en solo lectura", () => {
  setup(false, true);
  expect(
    within(insert())
      .getAllByRole("menuitem")
      .every((item) => item.getAttribute("aria-disabled") === "true"),
  ).toBe(true);
});
it("comparte las acciones de formato y permite deshacer y rehacer", () => {
  setup();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Formato" }), {
    key: "ArrowRight",
  });
  const menu = screen.getByRole("menu", { name: "Formato" });
  expect(menu).toHaveClass("min-w-[294px]");
  expect(within(menu).getAllByRole("menuitem")).toHaveLength(6);
  expect(within(menu).getByText("B")).toHaveClass("font-extrabold");
  expect(within(menu).getByText("</>")).toHaveClass("font-mono");
  fireEvent.click(within(menu).getByRole("menuitem", { name: /^Negrita/ }));
  expect(editor.state.doc.toString()).toBe("**texto**");
  fireEvent.contextMenu(screen.getByRole("button", { name: "Editor" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /^Deshacer/ }));
  expect(editor.state.doc.toString()).toBe("texto");
  fireEvent.contextMenu(screen.getByRole("button", { name: "Editor" }));
  fireEvent.click(screen.getByRole("menuitem", { name: /^Rehacer/ }));
  expect(editor.state.doc.toString()).toBe("**texto**");
});

it.each([
  ["MacIntel", "⌘Z", "⌘⇧Z"],
  ["Win32", "Ctrl+Z", "Ctrl+Mayús+Z"],
])("muestra los atajos de %s a la derecha", (platform, undo, redo) => {
  const original = Object.getOwnPropertyDescriptor(navigator, "platform");
  Object.defineProperty(navigator, "platform", { configurable: true, value: platform });
  try {
    setup();
    expect(screen.getByRole("menuitem", { name: "Deshacer" })).toHaveTextContent(undo);
    expect(screen.getByRole("menuitem", { name: "Rehacer" })).toHaveTextContent(redo);
  } finally {
    if (original) Object.defineProperty(navigator, "platform", original);
    else Reflect.deleteProperty(navigator, "platform");
  }
});

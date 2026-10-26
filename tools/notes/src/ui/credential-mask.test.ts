import { EditorView } from "@codemirror/view";
import { expect, it } from "vitest";
import { credentialMask, secretRanges } from "./credential-mask.ts";

it("tapa password y secret en el editor y conserva el documento al editar", () => {
  const source =
    "```credential\nuser: Ada\npassword: clave-invisible\nfield: Host | localhost\nsecret: PIN\\|reserva | 987654\n```\n\n```text\npassword: ejemplo-visible\n```";
  const parent = document.createElement("div");
  document.body.append(parent);
  const view = new EditorView({ doc: source, extensions: [credentialMask], parent });
  try {
    expect(view.state.doc.toString()).toBe(source);
    expect(view.contentDOM.textContent).not.toContain("clave-invisible");
    expect(view.contentDOM.textContent).not.toContain("987654");
    expect(view.contentDOM.textContent).toContain("•••••••");
    expect(view.contentDOM.textContent).toContain("Ada");
    expect(view.contentDOM.textContent).toContain("localhost");
    expect(view.contentDOM.textContent).toContain("ejemplo-visible");
    const from = source.indexOf("clave-invisible");
    view.dispatch({
      changes: { from, to: from + "clave-invisible".length, insert: "nueva-clave" },
    });
    expect(view.state.doc.toString()).toContain("password: nueva-clave");
    expect(view.contentDOM.textContent).not.toContain("nueva-clave");
  } finally {
    view.destroy();
    parent.remove();
  }
});

it.each([
  ["sangrada", "  ```credential\n  password: clave1\n  secret: PIN | 4321\n  ```\n"],
  ["en una cita", "> ```credential\n> password: clave1\n> secret: PIN | 4321\n> ```\n"],
  [
    "en una lista",
    "- elemento\n\n  ```credential\n  password: clave1\n  secret: PIN | 4321\n  ```\n",
  ],
])("tapa los secretos de una valla %s", (_name, source) => {
  const hidden = secretRanges(source).map(({ from, to }) => source.slice(from, to).trim());
  expect(hidden).toEqual(["clave1", "4321"]);
});

it("detecta la credencial igual que la vista previa aunque haya HTML antes", () => {
  const source = "<div>\n```text\n</div>\n\n```credential\npassword: expuesta\n```\n";
  const hidden = secretRanges(source).map(({ from, to }) => source.slice(from, to).trim());
  expect(hidden).toEqual(["expuesta"]);
});

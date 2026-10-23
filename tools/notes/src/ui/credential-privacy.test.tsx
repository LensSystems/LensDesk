import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it } from "vitest";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { vaultTestClient } from "./vault-test-client.ts";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
// Monta la aplicación entera con cifrado real: con la máquina cargada pasa de 5 s.
it("advierte antes de quitar privacidad: cerrar conserva el cifrado, aceptar la hace pública", {
  timeout: 15_000,
}, async () => {
  const f = vaultTestClient();
  const source = "```credential\nuser: Ada\npassword: clave-privada\n```";
  render(<App client={f.client as never} />);
  const element = await screen.findByRole("textbox", { name: "Editar" });
  await waitFor(() => expect(element).toHaveTextContent("Original"));
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error("Editor ausente");
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } }));
  fireEvent.click(screen.getByRole("radio", { name: "Ver" }));
  const card = document.querySelector(".ld-credential");
  if (!(card instanceof HTMLElement)) throw new Error("Tarjeta ausente");
  expect(card.innerHTML).not.toContain("clave-privada");
  const copy = within(card).getAllByRole("button", { name: "Copiar" })[1];
  if (!copy) throw new Error("Control de copia ausente");
  await act(async () => fireEvent.click(copy));
  expect(f.client.ui.copyText).toHaveBeenCalledWith("clave-privada");
  expect(card.innerHTML).not.toContain("clave-privada");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Quitar privada" })));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Las contraseñas quedarán sin cifrar");
  expect(f.invoke).not.toHaveBeenCalledWith("setPrivate", expect.anything());
  fireEvent.click(within(dialog).getByText("Cerrar", { selector: "button" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(f.row().private).toBe(true);
  expect(view.state.doc.toString()).toBe(source);
  expect(f.invoke).not.toHaveBeenCalledWith("setPrivate", expect.anything());
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Quitar privada" })));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Quitar privada",
    }),
  );
  await waitFor(() => expect(f.row().private).toBe(false));
  expect(f.row().body_md).toBe(source);
  expect(f.invoke).toHaveBeenCalledWith("setPrivate", { id: "one", private: false });
  await screen.findByRole("button", { name: "Hacer privada" });
  expect(document.querySelector(".ld-credential")).toBeNull();
  expect(document.querySelector("pre code.language-credential")).toHaveTextContent("clave-privada");
});

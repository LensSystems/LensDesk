import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const editor = () =>
  EditorView.findFromDOM(document.querySelector(".cm-content") as HTMLElement) as EditorView;
const append = (text: string) =>
  act(() => {
    const view = editor();
    view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
  });
it.each([true, false])(
  "la transición privada=%s congela el editor y guarda el cuerpo vigente con vaultStatus lento",
  async (privateNote) => {
    const f = vaultTestClient(privateNote);
    render(<App client={f.client as never} />);
    await waitFor(() =>
      expect(document.querySelector(".cm-content")).toHaveTextContent("Original"),
    );
    append(" antes");
    const release = f.delayStatus();
    fireEvent.click(
      screen.getByRole("button", { name: privateNote ? "Quitar privada" : "Hacer privada" }),
    );
    // Una actualización ya en vuelo puede llegar después del clic aunque el teclado esté congelado.
    append(" vigente");
    expect(editor().state.readOnly).toBe(true);
    expect(document.querySelector(".cm-content")).toHaveAttribute("contenteditable", "false");
    await act(async () => release());
    await screen.findByRole("button", { name: privateNote ? "Hacer privada" : "Quitar privada" });
    await waitFor(() => expect(f.row().private).toBe(!privateNote));
    expect(f.row().body_md).toBe("Original antes vigente");
    await waitFor(() =>
      expect(document.querySelector(".cm-content")).toHaveTextContent("Original antes vigente"),
    );
  },
);
it("setup congela el editor y usa el cuerpo vigente antes del update", async () => {
  const f = vaultTestClient(false, false);
  render(<App client={f.client as never} />);
  fireEvent.click(await screen.findByRole("button", { name: "Hacer privada" }));
  fireEvent.click(await screen.findByRole("button", { name: "Crear contraseña" }));
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fill("Contraseña", "Abcd1!");
  fill("Confirmar contraseña", "Abcd1!");
  fill("Respuesta 1", "Lima");
  fill("Respuesta 2", "Gato");
  const release = f.delaySetup();
  fireEvent.click(screen.getByRole("button", { name: "Guardar y bloquear" }));
  append(" vigente");
  expect(editor().state.readOnly).toBe(true);
  await act(async () => release());
  await waitFor(() => expect(f.row().private).toBe(true));
  expect(f.row().body_md).toBe("Original vigente");
});

it("lee el cuerpo vigente después de un autoguardado que seguía en vuelo al cambiar privacidad", async () => {
  const f = vaultTestClient();
  render(<App client={f.client as never} />);
  await waitFor(() => expect(document.querySelector(".cm-content")).toHaveTextContent("Original"));
  const release = f.delayUpdate();
  append(" antes");
  await waitFor(() =>
    expect(f.invoke).toHaveBeenCalledWith("update", { id: "one", body_md: "Original antes" }),
  );
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Quitar privada" })));
  append(" vigente");
  await act(async () => release());
  await waitFor(() => expect(f.row().private).toBe(false));
  expect(f.row().body_md).toBe("Original antes vigente");
});

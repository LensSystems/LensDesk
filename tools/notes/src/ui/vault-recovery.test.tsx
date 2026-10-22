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
async function edit(text = " borrador") {
  await waitFor(() => expect(document.querySelector(".cm-content")).toHaveTextContent("Original"));
  act(() => {
    const view = EditorView.findFromDOM(
      document.querySelector(".cm-content") as HTMLElement,
    ) as EditorView;
    view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
  });
}
async function unlock() {
  fireEvent.change(await screen.findByLabelText("Contraseña"), { target: { value: "Abcd1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
}
const restored = "No se guardaron los últimos cambios; se restauraron para que puedas guardarlos";
it("un fallo de autoguardado conserva el texto, muestra el error y reintenta al siguiente cambio", async () => {
  const f = vaultTestClient();
  render(<App client={f.client as never} />);
  f.fail("E_INTERNAL");
  await edit();
  await waitFor(() =>
    expect(f.invoke).toHaveBeenCalledWith("update", { id: "one", body_md: "Original borrador" }),
  );
  await screen.findByText(
    "No se pudieron guardar los últimos cambios. Se reintentará al editar de nuevo.",
  );
  expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador");
  f.fail(null);
  await edit(" nuevo");
  await waitFor(() => expect(f.row().body_md).toBe("Original borrador nuevo"), { timeout: 2000 });
});
it.each(["ocultar", "permiso", "inactividad"])(
  "recupera el borrador después de %s y lo vuelve a guardar",
  async (cause) => {
    const f = vaultTestClient();
    render(<App client={f.client as never} />);
    await edit();
    if (cause === "ocultar") {
      f.fail("E_INTERNAL");
      act(() => f.visibility(false));
    }
    if (cause === "permiso") f.fail("E_PERMISSION_DENIED");
    if (cause === "inactividad") f.expire();
    await screen.findByText("Contenido privado bloqueado", {}, { timeout: 2000 });
    expect(document.body).not.toHaveTextContent("Original borrador");
    if (cause === "ocultar")
      await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("vaultLock", {}));
    f.fail(null);
    act(() => f.visibility(true));
    await unlock();
    await waitFor(() =>
      expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador"),
    );
    await screen.findByText(restored);
    await waitFor(() => expect(f.row().body_md).toBe("Original borrador"), { timeout: 2000 });
  },
);
it("cerrar la herramienta descarta el borrador pendiente sin persistirlo", async () => {
  const f = vaultTestClient();
  const view = render(<App client={f.client as never} />);
  await edit();
  f.fail("E_INTERNAL");
  act(() => f.visibility(false));
  await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("vaultLock", {}));
  view.unmount();
  f.fail(null);
  render(<App client={f.client as never} />);
  await unlock();
  await waitFor(() => expect(document.querySelector(".cm-content")).toHaveTextContent("Original"));
  expect(document.querySelector(".cm-content")).not.toHaveTextContent("borrador");
  expect(screen.queryByText(restored)).toBeNull();
});

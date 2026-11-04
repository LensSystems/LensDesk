import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { vaultTestClient } from "./vault-test-client.ts";

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "es", resources: { es: { translation: es }, en: { translation: en } } });
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

it("reintenta el guardado privado tras una respuesta fallida aunque get ya devuelva el borrador", async () => {
  const f = vaultTestClient();
  const original = f.invoke.getMockImplementation();
  if (!original) throw new Error("Falta el backend de prueba");
  let updates = 0;
  let confirm = () => {};
  const confirmation = new Promise<void>((resolve) => {
    confirm = resolve;
  });
  f.invoke.mockImplementation(async (method, args) => {
    const result = await original(method, args);
    if (method === "list") {
      if (!Array.isArray(result)) throw new Error("Lista de prueba inválida");
      return [
        ...result,
        { ...f.row(), id: "two", title: "Otra", private: false, body_md: "Otro cuerpo" },
      ];
    }
    if (method === "update") {
      updates++;
      if (updates === 1) throw { code: "E_INTERNAL" };
      await confirmation;
    }
    return result;
  });
  render(<App client={f.client as never} />);
  try {
    await edit();
    fireEvent.blur(document.querySelector(".cm-content") as HTMLElement);
    await screen.findByRole("button", { name: "Reintentar guardado" });
    expect(f.row().body_md).toBe("Original borrador");
    fireEvent.click(screen.getByRole("button", { name: "Otra" }));
    await screen.findByRole("heading", { name: "Otra" });
    fireEvent.click(screen.getByRole("button", { name: "Visible" }));
    await waitFor(() =>
      expect(f.invoke.mock.calls.filter(([method]) => method === "get")).toHaveLength(2),
    );
    const retry = await screen.findByRole("button", { name: "Reintentar guardado" });
    expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador");
    expect(updates).toBe(1);
    fireEvent.click(retry);
    await waitFor(() => expect(updates).toBe(2));
    await screen.findByText("Guardando…", { exact: true });
    expect(screen.queryByText("Guardado", { exact: true })).toBeNull();
    await act(async () => confirm());
    await screen.findByText("Guardado", { exact: true });
    expect(screen.queryByRole("button", { name: "Reintentar guardado" })).toBeNull();
    expect(f.row().body_md).toBe("Original borrador");
    expect(f.row().private).toBe(true);
  } finally {
    await act(async () => confirm());
  }
});

it("volver a la nota privada o cambiar idioma conserva el error sin reintentar automáticamente", async () => {
  const f = vaultTestClient();
  const original = f.invoke.getMockImplementation();
  if (!original) throw new Error("Falta el backend de prueba");
  f.invoke.mockImplementation(async (method, args) => {
    if (method === "list") {
      const rows = await original(method, args);
      if (!Array.isArray(rows)) throw new Error("Lista de prueba inválida");
      return [
        ...rows,
        { ...f.row(), id: "two", title: "Otra", private: false, body_md: "Otro cuerpo" },
      ];
    }
    return original(method, args);
  });
  render(<App client={f.client as never} />);
  f.fail("E_INTERNAL");
  await edit();
  fireEvent.blur(document.querySelector(".cm-content") as HTMLElement);
  await screen.findByRole("button", { name: "Reintentar guardado" });
  const attempts = f.invoke.mock.calls.filter(([method]) => method === "update").length;
  f.fail(null);
  fireEvent.click(screen.getByRole("button", { name: "Otra" }));
  await screen.findByRole("heading", { name: "Otra" });
  fireEvent.click(screen.getByRole("button", { name: "Visible" }));
  await screen.findByRole("button", { name: "Reintentar guardado" });
  expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador");
  try {
    f.client.app.getContext = async () => ({ locale: "en", theme: "dark" });
    await act(async () => i18n.changeLanguage("en"));
    await screen.findByRole("button", { name: "Retry saving" });
    vi.useFakeTimers();
    await act(async () => vi.advanceTimersByTime(800));
    expect(f.invoke.mock.calls.filter(([method]) => method === "update")).toHaveLength(attempts);
    expect(f.row().body_md).toBe("Original");
  } finally {
    vi.useRealTimers();
    f.client.app.getContext = async () => ({ locale: "es", theme: "dark" });
    await act(async () => i18n.changeLanguage("es"));
  }
});

it.each([false, true])(
  "concluye el guardado privado por versión mientras otra nota está seleccionada; falla=%s",
  async (failure) => {
    const f = vaultTestClient();
    const original = f.invoke.getMockImplementation();
    if (!original) throw new Error("Falta el backend de prueba");
    f.invoke.mockImplementation(async (method, args) => {
      if (method === "list") {
        const rows = await original(method, args);
        if (!Array.isArray(rows)) throw new Error("Lista de prueba inválida");
        return [
          ...rows,
          { ...f.row(), id: "two", title: "Otra", private: false, body_md: "Otro cuerpo" },
        ];
      }
      return original(method, args);
    });
    const release = f.delayUpdate();
    render(<App client={f.client as never} />);
    await edit();
    fireEvent.blur(document.querySelector(".cm-content") as HTMLElement);
    await screen.findByText("Guardando…", { exact: true });
    fireEvent.click(screen.getByRole("button", { name: "Otra" }));
    await screen.findByRole("heading", { name: "Otra" });
    if (failure) f.fail("E_INTERNAL");
    await act(async () => release());
    expect(screen.queryByRole("button", { name: "Reintentar guardado" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Visible" }));
    if (failure) await screen.findByRole("button", { name: "Reintentar guardado" });
    else await screen.findByText("Guardado", { exact: true });
    expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador");
    expect(screen.queryByText("Guardando…", { exact: true })).toBeNull();
  },
);

it("revertir el cuerpo privado antes del guardado vuelve a Sin cambios", async () => {
  const f = vaultTestClient();
  render(<App client={f.client as never} />);
  await edit();
  const element = document.querySelector(".cm-content") as HTMLElement;
  act(() => {
    const view = EditorView.findFromDOM(element) as EditorView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "Original" } });
  });
  fireEvent.blur(element);
  expect(await screen.findByText("Sin cambios", { exact: true })).toBeTruthy();
  expect(f.invoke).not.toHaveBeenCalledWith("update", expect.anything());
});

it("reintenta explícitamente el borrador privado y no ofrece reintento estando bloqueada", async () => {
  const f = vaultTestClient();
  render(<App client={f.client as never} />);
  f.fail("E_INTERNAL");
  await edit();
  fireEvent.blur(document.querySelector(".cm-content") as HTMLElement);
  const retry = await screen.findByRole("button", { name: "Reintentar guardado" });
  expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador");
  f.fail(null);
  fireEvent.click(retry);
  await waitFor(() => expect(f.row().body_md).toBe("Original borrador"));
  expect(await screen.findByText("Guardado", { exact: true })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Bloquear notas privadas" }));
  await screen.findByText("Esta nota es privada");
  expect(screen.queryByRole("button", { name: "Reintentar guardado" })).toBeNull();
  expect(document.body).not.toHaveTextContent("Original borrador");
});
// El bloqueo llega tras la pausa de 800 ms del autoguardado: con la máquina cargada hace falta margen.
it("un fallo de autoguardado conserva el texto, muestra el error y reintenta al siguiente cambio", {
  timeout: 15_000,
}, async () => {
  const f = vaultTestClient();
  render(<App client={f.client as never} />);
  f.fail("E_INTERNAL");
  await edit();
  await waitFor(() =>
    expect(f.invoke).toHaveBeenCalledWith("update", { id: "one", body_md: "Original borrador" }),
  );
  await screen.findByText("No se guardaron los cambios.");
  expect(screen.getByRole("button", { name: "Reintentar guardado" })).toBeTruthy();
  expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador");
  f.fail(null);
  await edit(" nuevo");
  await waitFor(() => expect(f.row().body_md).toBe("Original borrador nuevo"), { timeout: 5000 });
});
it.each(["ocultar", "permiso", "inactividad", "candado"])(
  "recupera el borrador después de %s y lo vuelve a guardar",
  { timeout: 15_000 },
  async (cause) => {
    const f = vaultTestClient();
    render(<App client={f.client as never} />);
    await edit();
    if (cause === "ocultar") {
      f.fail("E_INTERNAL");
      act(() => f.visibility(false));
    }
    if (cause === "candado")
      fireEvent.click(screen.getByRole("button", { name: "Bloquear notas privadas" }));
    if (cause === "permiso") f.fail("E_PERMISSION_DENIED");
    if (cause === "inactividad") f.expire();
    await screen.findByText("Esta nota es privada", {}, { timeout: 5000 });
    expect(document.body).not.toHaveTextContent("Original borrador");
    if (cause === "ocultar")
      await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("vaultLock", {}));
    f.fail(null);
    act(() => f.visibility(true));
    await unlock();
    await waitFor(() =>
      expect(document.querySelector(".cm-content")).toHaveTextContent("Original borrador"),
    );
    if (cause !== "candado") await screen.findByText(restored);
    else {
      const methods = f.invoke.mock.calls.map(([method]) => method);
      expect(methods.indexOf("update")).toBeLessThan(methods.indexOf("vaultLock"));
    }
    await waitFor(() => expect(f.row().body_md).toBe("Original borrador"), { timeout: 5000 });
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

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "codemirror";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import type { Note } from "./NoteList.tsx";
import { validPassword } from "./password-validation.ts";
import { normalLockout } from "./vault-lockout.ts";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "es",
    fallbackLng: "es",
    resources: { es: { translation: es }, en: { translation: en } },
  });
});
function fake(privateNote = false, unlocked = false) {
  let note: Note = {
    id: "one",
    title: "Visible",
    body_md: "Contenido secreto",
    private: privateNote,
    pinned: false,
    created_at: "now",
    updated_at: "now",
    deleted_at: null,
  };
  let configured = privateNote;
  let password = "Abcd1!";
  const failures = { vaultUnlock: 0, vaultReset: 0 };
  let questions = ["Ciudad", "Animal"];
  let visibility = (_visible: boolean) => {};
  let resolveGet: (() => void) | undefined;
  let delayed = false;
  const invoke = vi.fn(async (method: string, args: Record<string, unknown>) => {
    if (method === "list" || method === "search")
      return [{ ...note, body_md: note.private ? "" : note.body_md }];
    if (method === "vaultStatus")
      return {
        configured,
        unlocked,
        questions,
        privateCount: note.private ? 1 : 0,
        lockout: normalLockout,
      };
    if (method === "vaultLock") {
      unlocked = false;
      return {};
    }
    if (method === "vaultSetup") {
      configured = true;
      unlocked = true;
      password = args.password as string;
      questions = args.questions as string[];
      return {};
    }
    if (method === "vaultUnlock" || method === "vaultReset") {
      if (
        (method === "vaultUnlock" && args.password !== password) ||
        (method === "vaultReset" && JSON.stringify(args.answers) !== '["Lima","Gato"]')
      ) {
        failures[method] += 1;
        throw {
          code: "E_PERMISSION_DENIED",
          message: `Invalid credentials. ${5 - failures[method]} attempts left`,
        };
      }
      if (method === "vaultReset") password = args.password as string;
      failures.vaultUnlock = 0;
      failures.vaultReset = 0;
      unlocked = true;
      return {};
    }
    if (method === "get") {
      if (delayed)
        await new Promise<void>((resolve) => {
          resolveGet = resolve;
        });
      if (!unlocked) throw { code: "E_PERMISSION_DENIED" };
      return { ...note };
    }
    if (method === "update") {
      if (note.private && !unlocked) throw { code: "E_PERMISSION_DENIED" };
      note = { ...note, body_md: args.body_md as string };
      return { ...note };
    }
    if (method === "setPrivate") {
      note = { ...note, private: args.private as boolean };
      return { ...note };
    }
    if (method === "rename") {
      note = { ...note, title: args.title as string };
      return { ...note };
    }
    throw new Error(method);
  });
  const client = {
    backend: { invoke },
    storage: { get: vi.fn(async () => true) },
    app: {
      getContext: async () => ({ locale: "es", theme: "dark" }),
      onContextChange: () => () => {},
      onVisibilityChange: (listener: typeof visibility) => {
        const prior = visibility;
        visibility = (value) => {
          prior(value);
          listener(value);
        };
        return () => {};
      },
    },
    ui: { copyText: vi.fn(async () => {}) },
    files: { pickSave: vi.fn(async () => null) },
  };
  return {
    client,
    invoke,
    visibility: (value: boolean) => visibility(value),
    delay: () => {
      delayed = true;
    },
    resolve: () => resolveGet?.(),
    note: () => note,
    expire: () => {
      unlocked = false;
    },
  };
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("contraseñas privadas", () => {
  it.each(["Aa1!", "Aa12345678!", "abcd1!", "ABCD1!", "Abcde!", "Abcde1", "Abcd1 "])(
    "rechaza %s",
    (password) => expect(validPassword(password, password)).toBe(false),
  );
  it("acepta extremos y exige confirmación", () => {
    expect(validPassword("Abcd1!", "Abcd1!")).toBe(true);
    expect(validPassword("Abcdefgh1!", "Abcdefgh1!")).toBe(true);
    expect(validPassword("Abcd1!", "Abcd2!")).toBe(false);
  });
});
it("carga get antes de editar o guardar una privada y descarta respuestas después del bloqueo", async () => {
  const f = fake(true, true);
  f.delay();
  render(<App client={f.client as never} />);
  await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("get", { id: "one" }));
  expect(screen.queryByRole("button", { name: "Copiar nota" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  expect(document.querySelector(".cm-content")).toBeNull();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 850));
  });
  expect(f.invoke.mock.calls.filter(([method]) => method === "update")).toHaveLength(0);
  await act(async () => f.resolve());
  await waitFor(() =>
    expect(document.querySelector(".cm-content")).toHaveTextContent("Contenido secreto"),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 850));
  });
  expect(f.invoke.mock.calls.filter(([method]) => method === "update")).toHaveLength(0);
  act(() => f.visibility(false));
  await screen.findByText("Esta nota es privada");
  expect(document.body).not.toHaveTextContent("Contenido secreto");
  expect(f.note().body_md).toBe("Contenido secreto");
});
// Monta la aplicación entera con cifrado real: con la máquina cargada pasa de 5 s.
it("configura, bloquea, rechaza contraseña errónea, desbloquea y restablece sin perder contenido", {
  timeout: 15_000,
}, async () => {
  const f = fake();
  render(<App client={f.client as never} />);
  const trigger = await screen.findByRole("button", { name: "Hacer privada" });
  fireEvent.click(trigger);
  await screen.findByRole("dialog");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "Crear contraseña" }));
  await waitFor(() => expect(screen.getByLabelText("Contraseña")).toHaveFocus());
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("button", { name: "Crear contraseña" }));
  await waitFor(() => expect(screen.getByLabelText("Contraseña")).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
  expect(await screen.findByRole("dialog", { name: "Notas privadas" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Crear contraseña" }));
  fill("Contraseña", "Abcd1!");
  fill("Confirmar contraseña", "Abcd1!");
  fill("Respuesta 1", "Lima");
  fill("Respuesta 2", "Gato");
  fireEvent.click(screen.getByRole("button", { name: "Guardar y bloquear" }));
  await screen.findByRole("heading", { name: "Esta nota es privada" });
  expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  fill("Contraseña", "Abcd1!");
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  await screen.findByRole("button", { name: "Quitar privada" });
  await waitFor(() =>
    expect(document.querySelector(".cm-content")).toHaveTextContent("Contenido secreto"),
  );
  act(() => f.visibility(false));
  await screen.findByText("Esta nota es privada");
  act(() => f.visibility(true));
  fill("Contraseña", "incorrecta");
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  await screen.findByText("Contraseña incorrecta. 4 intentos más antes de esperar 30 s.");
  fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste la contraseña?" }));
  expect(
    await screen.findByRole("dialog", { name: "Restablecer contraseña" }),
  ).not.toHaveTextContent("Contraseña incorrecta");
  fill("¿Cómo se llamaba tu primera mascota?", "no");
  fill("¿En qué ciudad naciste?", "no");
  fill("Contraseña", "Nueva1!");
  fill("Confirmar contraseña", "Nueva1!");
  fireEvent.click(screen.getByRole("button", { name: "Restablecer contraseña" }));
  await screen.findByText("Respuestas incorrectas. Quedan 4 intentos antes de esperar 30 s.");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("alert")).toBeNull();
  fill("Contraseña", "incorrecta");
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  await screen.findByText("Contraseña incorrecta. 3 intentos más antes de esperar 30 s.");
  fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste la contraseña?" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByLabelText("¿Cómo se llamaba tu primera mascota?")).toHaveValue("");
  expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  expect(screen.getByLabelText("Contraseña")).not.toHaveAttribute("aria-invalid");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  fill("Contraseña", "Abcd1!");
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  await waitFor(() =>
    expect(document.querySelector(".cm-content")).toHaveTextContent("Contenido secreto"),
  );
  act(() => f.visibility(false));
  act(() => f.visibility(true));
  fireEvent.click(await screen.findByRole("button", { name: "¿Olvidaste la contraseña?" }));
  await waitFor(() =>
    expect(screen.getByLabelText("¿Cómo se llamaba tu primera mascota?")).toHaveFocus(),
  );
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.getByRole("heading", { name: "Visible" })).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste la contraseña?" }));
  const dialog = await screen.findByRole("dialog");
  fill("¿Cómo se llamaba tu primera mascota?", "Lima");
  fill("¿En qué ciudad naciste?", "Gato");
  fireEvent.change(within(dialog).getByLabelText("Contraseña"), { target: { value: "Nuevo2!" } });
  fill("Confirmar contraseña", "Nuevo2!");
  fireEvent.click(within(dialog).getByRole("button", { name: "Restablecer contraseña" }));
  await waitFor(() =>
    expect(document.querySelector(".cm-content")).toHaveTextContent("Contenido secreto"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Quitar privada" }));
  await screen.findByRole("button", { name: "Hacer privada" });
  expect(f.note().private).toBe(false);
  expect(f.note().body_md).toBe("Contenido secreto");
});

it("ignora un get que termina después de ocultar la herramienta", async () => {
  const f = fake(true, true);
  f.delay();
  render(<App client={f.client as never} />);
  await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("get", { id: "one" }));
  act(() => f.visibility(false));
  await act(async () => f.resolve());
  expect(document.querySelector(".cm-content")).toBeNull();
  expect(document.body).not.toHaveTextContent("Contenido secreto");
  expect(f.invoke.mock.calls.filter(([method]) => method === "update")).toHaveLength(0);
});
// Monta la aplicación entera con cifrado real: con la máquina cargada pasa de 5 s.
it("guarda cambios privados antes de bloquear y detecta la caducidad del backend", {
  timeout: 15_000,
}, async () => {
  const f = fake(true, true);
  render(<App client={f.client as never} />);
  await waitFor(() =>
    expect(document.querySelector(".cm-content")).toHaveTextContent("Contenido secreto"),
  );
  act(() => {
    const view = EditorView.findFromDOM(document.querySelector(".cm-content") as HTMLElement);
    view?.dispatch({ changes: { from: view.state.doc.length, insert: " editado" } });
  });
  act(() => f.visibility(false));
  await waitFor(() => expect(f.invoke).toHaveBeenCalledWith("vaultLock", {}));
  const methods = f.invoke.mock.calls.map(([method]) => method);
  expect(methods.indexOf("update")).toBeLessThan(methods.indexOf("vaultLock"));
  expect(f.note().body_md).toBe("Contenido secreto editado");
  expect(document.body).not.toHaveTextContent("Contenido secreto");
  expect(screen.queryByRole("button", { name: "Copiar nota" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  act(() => f.visibility(true));
  fill("Contraseña", "Abcd1!");
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  await waitFor(() =>
    expect(document.querySelector(".cm-content")).toHaveTextContent("Contenido secreto editado"),
  );
  f.expire();
  await screen.findByText("Esta nota es privada", {}, { timeout: 2000 });
  expect(document.querySelector(".cm-content")).toBeNull();
});

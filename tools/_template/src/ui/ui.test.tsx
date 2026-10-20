import type { createToolClient } from "@lensdesk/sdk";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";

type Context = Awaited<ReturnType<ReturnType<typeof createToolClient>["app"]["getContext"]>>;

function fakeClient() {
  let listener: ((context: Context) => void) | undefined;
  const unsubscribe = vi.fn();
  const client = {
    app: {
      getContext: vi.fn(async () => ({
        locale: "es",
        theme: "dark",
        hostVersion: "",
        toolVersion: "",
      })),
      onContextChange: vi.fn((callback: (context: Context) => void) => {
        listener = callback;
        return unsubscribe;
      }),
    },
    storage: { get: vi.fn(async () => 4), set: vi.fn(async () => undefined) },
    backend: { invoke: vi.fn(async () => ({ pong: true, at: "2026-10-20" })) },
    files: {
      pickOpen: vi.fn(async () => [{ token: "text-token", name: "example.txt", size: 12 }]),
      readText: vi.fn(async () => "Contenido local\nsegunda línea"),
    },
  };
  return {
    client,
    unsubscribe,
    context: (context: Context) => listener?.(context),
    render: () => render(<App client={client as unknown as ReturnType<typeof createToolClient>} />),
  };
}

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, en: { translation: en } },
    lng: "es",
    fallbackLng: "es",
    interpolation: { escapeValue: false },
  });
});
beforeEach(async () => {
  await i18n.changeLanguage("es");
});

describe("Plantilla", () => {
  it("muestra el encabezado y las tres acciones con descripción y botón", async () => {
    fakeClient().render();
    expect(screen.getByRole("heading", { level: 1, name: es.title })).toBeInTheDocument();
    expect(screen.getByText("Idioma: es · Tema: dark")).toBeInTheDocument();
    const section = screen.getByRole("region", { name: es.actionsHeading });
    const rows: [string, string, string][] = [
      ["Contador: 4", es.storageDescription, es.incrementButton],
      [es.backendLabel, es.backendDescription, es.pingButton],
      [es.filesLabel, es.filesDescription, es.openFileButton],
    ];
    for (const [label, description, button] of rows) {
      const row = (await within(section).findByText(label)).parentElement?.parentElement;
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByText(description)).toBeInTheDocument();
      expect(within(row as HTMLElement).getByRole("button", { name: button })).toBeInTheDocument();
    }
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("incrementa el contador persistido y lo guarda", async () => {
    const fake = fakeClient();
    fake.render();
    await screen.findByText("Contador: 4");
    fireEvent.click(screen.getByRole("button", { name: es.incrementButton }));
    expect(await screen.findByText("Contador: 5")).toBeInTheDocument();
    expect(fake.client.storage.set).toHaveBeenCalledWith("count", 5);
  });

  it("deshabilita el backend mientras espera y presenta el error con su código", async () => {
    const fake = fakeClient();
    let reject!: (reason: unknown) => void;
    fake.client.backend.invoke.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    fake.render();
    fireEvent.click(screen.getByRole("button", { name: es.pingButton }));
    expect(screen.getByRole("button", { name: es.pingButton })).toBeDisabled();
    await act(async () => reject({ code: "E_INTERNAL" }));
    const output = screen.getByRole("status");
    expect(output.tagName).toBe("OUTPUT");
    expect(output).toHaveAttribute("aria-live", "polite");
    expect(output).toHaveTextContent("No se pudo completar la acción (E_INTERNAL)");
    expect(output).toHaveClass("bg-danger-soft", "text-danger");
    expect(screen.getByRole("button", { name: es.pingButton })).toBeEnabled();
    expect(fake.client.backend.invoke).toHaveBeenCalledWith("ping");
  });

  it("muestra el archivo en output usando solo su token", async () => {
    const fake = fakeClient();
    fake.render();
    fireEvent.click(screen.getByRole("button", { name: es.openFileButton }));
    const output = await screen.findByRole("status");
    expect(output.textContent).toBe("Contenido local\nsegunda línea");
    expect(output).toHaveClass("bg-bg", "font-mono", "wrap-anywhere");
    expect(fake.client.files.pickOpen).toHaveBeenCalledWith({ multiple: false });
    expect(fake.client.files.readText).toHaveBeenCalledWith("text-token");
  });

  it("aplica los cambios de idioma y tema en vivo y cancela la suscripción", async () => {
    const fake = fakeClient();
    const view = fake.render();
    await screen.findByText("Contador: 4");
    await act(async () =>
      fake.context({ locale: "en", theme: "light", hostVersion: "", toolVersion: "" }),
    );
    expect(screen.getByRole("heading", { level: 1, name: en.title })).toBeInTheDocument();
    expect(screen.getByText("Language: en · Theme: light")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await waitFor(() => expect(document.title).toBe(en.title));
    view.unmount();
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
  });
});

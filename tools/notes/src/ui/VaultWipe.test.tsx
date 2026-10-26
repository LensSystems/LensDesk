import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it } from "vitest";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { lockoutClient } from "./lockout-test-client.ts";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it.each([0, 1, 3])(
  "restablece con %s notas privadas y abre primera configuración",
  async (count) => {
    const f = lockoutClient(count);
    f.status.lockout.password.stage = "exhausted";
    render(<App client={f.client as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Restablecer notas privadas" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Restablecer notas privadas?" });
    expect(dialog).toHaveTextContent(
      count === 0
        ? es.vault.wipeEmpty
        : count === 1
          ? es.vault.wipeCount_one
          : es.vault.wipeCount_other.replace("{{count}}", "3"),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Restablecer notas privadas" }));
    expect(await screen.findByRole("dialog", { name: "Notas privadas" })).toBeInTheDocument();
    expect(f.invoke).toHaveBeenCalledWith("vaultWipe", {});
    const methods = f.invoke.mock.calls.map(([method]) => method);
    const wipe = methods.indexOf("vaultWipe");
    expect(methods.slice(wipe + 1)).toContain("vaultStatus");
    expect(methods.slice(wipe + 1)).toContain("list");
    expect(screen.queryByRole("heading", { name: "Visible" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Crear contraseña" }));
    expect(await screen.findByRole("dialog", { name: "Crear contraseña" })).toBeInTheDocument();
    for (const [name, value] of [
      ["Contraseña", "Nueva1!"],
      ["Confirmar contraseña", "Nueva1!"],
      ["Respuesta 1", "Lima"],
      ["Respuesta 2", "Gato"],
    ]) {
      fireEvent.change(screen.getByLabelText(name as string), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Guardar y bloquear" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(f.invoke).toHaveBeenCalledWith("vaultSetup", expect.anything());
    expect(f.invoke.mock.calls.map(([method]) => method)).not.toContain("setPrivate");
  },
);
it("permite pasar del aviso del décimo fallo a la confirmación destructiva", async () => {
  const f = lockoutClient();
  f.fail("Attempt limit reached. Wait 1800 seconds", "limit");
  render(<App client={f.client as never} />);
  fireEvent.change(await screen.findByLabelText("Contraseña"), { target: { value: "incorrecta" } });
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  const dialog = await screen.findByRole("dialog", { name: "Demasiados intentos fallidos" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Restablecer notas privadas" }));
  expect(
    await screen.findByRole("dialog", { name: "¿Restablecer notas privadas?" }),
  ).toBeInTheDocument();
});
it("conserva el diálogo y muestra el error si vaultWipe falla", async () => {
  const f = lockoutClient();
  const original = f.invoke.getMockImplementation();
  f.invoke.mockImplementation(async (method, args) => {
    if (method === "vaultWipe") throw new Error("failed");
    return original ? original(method, args) : {};
  });
  f.status.lockout.password.stage = "exhausted";
  render(<App client={f.client as never} />);
  fireEvent.click(await screen.findByRole("button", { name: "Restablecer notas privadas" }));
  const dialog = await screen.findByRole("dialog", { name: "¿Restablecer notas privadas?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Restablecer notas privadas" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(es.vault.invalid);
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it } from "vitest";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { lockoutClient } from "./lockout-test-client.ts";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it.each([false, true])(
  "vuelve al panel pausado del diálogo Desbloquear (restablecer=%s)",
  async (wipe) => {
    const f = lockoutClient(1, false, false);
    f.fail("Attempt limit reached. Wait 1800 seconds", "limit");
    render(<App client={f.client as never} />);
    fireEvent.click(await screen.findByRole("button", { name: "Hacer privada" }));
    const unlock = await screen.findByRole("dialog", { name: "Desbloquear" });
    fireEvent.change(within(unlock).getByLabelText("Contraseña"), {
      target: { value: "incorrecta" },
    });
    fireEvent.click(within(unlock).getByRole("button", { name: "Desbloquear" }));
    const notice = await screen.findByRole("dialog", { name: "Demasiados intentos fallidos" });
    fireEvent.click(
      within(notice).getByRole("button", {
        name: wipe ? "Restablecer notas privadas" : "Intentar más tarde",
      }),
    );
    if (wipe) {
      await screen.findByRole("dialog", { name: "¿Restablecer notas privadas?" });
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    }
    expect(await screen.findByRole("dialog", { name: "Desbloquear" })).toHaveTextContent(
      "Desbloqueo en pausa",
    );
  },
);

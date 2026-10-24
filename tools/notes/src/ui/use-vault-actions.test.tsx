import { act, renderHook } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { useVaultActions } from "./use-vault-actions.ts";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it.each([
  [false, 4, "Contraseña incorrecta. Quedan 4 intentos antes de esperar 30 s."],
  [false, 1, "Contraseña incorrecta. Queda 1 intento antes de esperar 30 s."],
  [true, 4, "Respuestas incorrectas. Quedan 4 intentos antes de esperar 30 s."],
  [true, 1, "Respuestas incorrectas. Queda 1 intento antes de esperar 30 s."],
  [false, 0, "Demasiados intentos. Espera 30 segundos."],
] as const)("traduce el error (respuestas=%s, restantes=%s)", async (recovery, count, expected) => {
  const client = {
    backend: {
      invoke: vi.fn(async () => {
        throw {
          code: "E_PERMISSION_DENIED",
          message: count
            ? `Invalid credentials. ${count} attempts left`
            : "Too many attempts. Wait 30 seconds",
        };
      }),
    },
  };
  const { result } = renderHook(() =>
    useVaultActions(client as never, {} as never, { current: true }, vi.fn(), vi.fn()),
  );
  await act(async () => {
    if (recovery) await result.current.reset("Nueva1!", ["a", "b"]);
    else await result.current.unlock("incorrecta");
  });
  expect(result.current.error).toBe(expected);
  expect(result.current.busy).toBe(false);
});

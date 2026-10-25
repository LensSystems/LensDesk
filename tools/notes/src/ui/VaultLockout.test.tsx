import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { App } from "./App.tsx";
import { lockoutClient } from "./lockout-test-client.ts";
import { ResetPassword } from "./ResetPassword.tsx";
import { UnlockPanel } from "./UnlockPanel.tsx";
import { normalLockout } from "./vault-lockout.ts";

beforeAll(async () => {
  await i18n
    .use(initReactI18next)
    .init({ lng: "es", resources: { es: { translation: es }, en: { translation: en } } });
});
afterEach(() => {
  vi.useRealTimers();
});
const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
async function mounted(stage: "normal" | "wait" | "limit" | "last" | "exhausted") {
  const f = lockoutClient();
  f.status.lockout.password = {
    stage,
    failures: 10,
    retryAt:
      stage === "limit" ? Date.now() + 1_800_000 : stage === "wait" ? Date.now() + 30_000 : null,
  };
  render(<App client={f.client as never} />);
  await screen.findByRole("button", { name: "Visible" });
  return f;
}
it("desactiva contraseña y desbloqueo durante la espera y actualiza con el sondeo existente", async () => {
  vi.useFakeTimers();
  const f = lockoutClient();
  f.status.lockout.password = { stage: "wait", failures: 5, retryAt: Date.now() + 2000 };
  render(<App client={f.client as never} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByLabelText("Contraseña")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Desbloquear" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Espera 2 segundos.");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Espera 1 segundos.");
  f.status.lockout.password = { stage: "normal", failures: 5, retryAt: null };
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByLabelText("Contraseña")).toBeEnabled();
  expect(screen.queryByRole("alert")).toBeNull();
  fill("Contraseña", "Abcd1!");
  expect(screen.getByRole("button", { name: "Desbloquear" })).toBeEnabled();
});
it("muestra pausa, tiempo y hora local, y abre preguntas o confirmación", async () => {
  const f = await mounted("limit");
  expect(screen.getByRole("heading", { name: "Desbloqueo en pausa" })).toBeInTheDocument();
  expect(screen.getByRole("timer")).toHaveAccessibleName(
    /Tiempo restante: 30 min 0 s|Tiempo restante: 29 min 59 s/,
  );
  const time = new Intl.DateTimeFormat("es", { timeStyle: "short" }).format(
    f.status.lockout.password.retryAt as number,
  );
  expect(screen.getByText(`Disponible a las ${time}`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Usar preguntas" }));
  expect(await screen.findByRole("dialog", { name: "Restablecer contraseña" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));
  expect(
    await screen.findByRole("dialog", { name: "¿Restablecer notas privadas?" }),
  ).toBeInTheDocument();
});
it("la cuenta atrás de pausa baja con el sondeo y da paso al último intento", async () => {
  vi.useFakeTimers();
  const f = lockoutClient();
  f.status.lockout.password = { stage: "limit", failures: 10, retryAt: Date.now() + 2000 };
  render(<App client={f.client as never} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByRole("timer", { name: "Tiempo restante: 0 min 2 s" })).toHaveTextContent(
    "00:02",
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByRole("timer", { name: "Tiempo restante: 0 min 1 s" })).toHaveTextContent(
    "00:01",
  );
  f.status.lockout.password = { stage: "last", failures: 10, retryAt: null };
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByLabelText("Contraseña")).toBeEnabled();
  expect(screen.getByText(es.vault.lastPassword)).toBeInTheDocument();
});
it("muestra el aviso del último intento", async () => {
  await mounted("last");
  expect(await screen.findByText(es.vault.lastPassword)).toHaveClass("text-warning");
});
it.each(["password", "recovery"] as const)("agota el panel cuando %s está agotado", (purpose) => {
  const lockout = structuredClone(normalLockout);
  lockout[purpose].stage = "exhausted";
  render(
    <UnlockPanel busy={false} error="" lockout={lockout} onSubmit={vi.fn()} onForgot={vi.fn()} />,
  );
  expect(screen.getByRole("heading", { name: "No quedan intentos" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Contraseña")).toBeNull();
  expect(screen.getByRole("button", { name: "Restablecer notas privadas" })).toBeInTheDocument();
});
it.each(["wait", "limit", "last"] as const)("respuestas usa su propio estado %s", (stage) => {
  const lockout = structuredClone(normalLockout);
  lockout.recovery = { stage, failures: 10, retryAt: Date.now() + 1_800_000 };
  render(
    <ResetPassword
      lockout={lockout}
      questions={["Ciudad", "Animal"]}
      busy={false}
      error=""
      onClose={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
  fill("Ciudad", "Lima");
  fill("Animal", "Gato");
  fill("Contraseña", "Nueva1!");
  fill("Confirmar contraseña", "Nueva1!");
  const button = screen.getByRole("button", { name: "Restablecer contraseña" });
  if (stage === "last") {
    expect(button).toBeEnabled();
    expect(screen.getByText(es.vault.lastAnswers)).toBeInTheDocument();
  } else {
    expect(button).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      stage === "limit" ? "Espera 30 minutos." : "Espera 1800 segundos.",
    );
  }
});
it.each([false, true])(
  "abre el aviso tras el décimo fallo (respuestas=%s) y permite cerrarlo",
  async (recovery) => {
    const f = await mounted("normal");
    f.fail("Attempt limit reached. Wait 1800 seconds", "limit");
    if (recovery) {
      fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste la contraseña?" }));
      fill("Ciudad", "no");
      fill("Animal", "no");
      fill("Contraseña", "Nueva1!");
      fill("Confirmar contraseña", "Nueva1!");
    } else fill("Contraseña", "incorrecta");
    fireEvent.click(
      screen.getByRole("button", { name: recovery ? "Restablecer contraseña" : "Desbloquear" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Demasiados intentos fallidos" });
    expect(dialog).toHaveTextContent(es.vault.limitHelp);
    expect(within(dialog).getByText(es.vault.tryLaterHelp)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Intentar más tarde" })).toHaveFocus(),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Intentar más tarde" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen.getByRole("heading", {
        name: recovery ? "Esta nota es privada" : "Desbloqueo en pausa",
      }),
    ).toBeInTheDocument();
  },
);
it.each([false, true])(
  "abre confirmación tras el último fallo (respuestas=%s)",
  async (recovery) => {
    const f = await mounted("last");
    f.fail("No attempts left", "exhausted");
    if (recovery) {
      fireEvent.click(screen.getByRole("button", { name: "¿Olvidaste la contraseña?" }));
      fill("Ciudad", "no");
      fill("Animal", "no");
      fill("Contraseña", "Nueva1!");
      fill("Confirmar contraseña", "Nueva1!");
    } else fill("Contraseña", "incorrecta");
    fireEvent.click(
      screen.getByRole("button", { name: recovery ? "Restablecer contraseña" : "Desbloquear" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "No quedan intentos" });
    expect(dialog).toHaveTextContent(es.vault.lastFailed);
    fireEvent.click(within(dialog).getByRole("button", { name: "Restablecer notas privadas" }));
    expect(
      await screen.findByRole("dialog", { name: "¿Restablecer notas privadas?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("heading", { name: "No quedan intentos" })).toBeInTheDocument();
  },
);

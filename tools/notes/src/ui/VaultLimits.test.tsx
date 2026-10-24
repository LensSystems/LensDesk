import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { PasswordSetup } from "./PasswordSetup.tsx";
import { ResetPassword } from "./ResetPassword.tsx";
import { UnlockPanel } from "./UnlockPanel.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const props = { onClose: vi.fn(), onSubmit: vi.fn(), error: "", busy: false };

it.each(["setup", "reset", "unlock"])("limita todos los campos de contraseña: %s", (form) => {
  if (form === "setup") render(<PasswordSetup {...props} onBack={vi.fn()} />);
  else if (form === "reset")
    render(<ResetPassword {...props} questions={["Primera", "Segunda"]} />);
  else render(<UnlockPanel {...props} onForgot={vi.fn()} />);
  for (const label of form === "unlock" ? ["Contraseña"] : ["Contraseña", "Confirmar contraseña"]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("maxlength", "10");
    fill(label, "Ab1!😀😀😀😀😀😀");
    expect(input).toHaveValue("Ab1!😀😀😀😀😀😀");
    fill(label, "Ab1!😀😀😀😀😀😀x");
    expect(input).toHaveValue("Ab1!😀😀😀😀😀😀");
  }
});

it.each(["setup", "reset"])("exige respuestas de 2–20 caracteres tras trim: %s", (form) => {
  const onSubmit = vi.fn();
  if (form === "setup") render(<PasswordSetup {...props} onSubmit={onSubmit} onBack={vi.fn()} />);
  else render(<ResetPassword {...props} onSubmit={onSubmit} questions={["Primera", "Segunda"]} />);
  const labels = form === "setup" ? ["Respuesta 1", "Respuesta 2"] : ["Primera", "Segunda"];
  const button = screen.getByRole("button", {
    name: form === "setup" ? "Guardar y bloquear" : "Restablecer contraseña",
  });
  fill("Contraseña", "Abc123!");
  fill("Confirmar contraseña", "Abc123!");
  for (const label of labels) {
    expect(screen.getByLabelText(label)).toHaveAttribute("maxlength", "20");
    fill(label, " x ");
  }
  expect(button).toBeDisabled();
  fireEvent.submit(button.closest("form") as HTMLFormElement);
  expect(onSubmit).not.toHaveBeenCalled();
  for (const label of labels) fill(label, "😀😀");
  expect(button).toBeEnabled();
  fill(labels[0] as string, "x".repeat(20));
  fill(labels[0] as string, "x".repeat(21));
  expect(screen.getByLabelText(labels[0] as string)).toHaveValue("x".repeat(20));
});

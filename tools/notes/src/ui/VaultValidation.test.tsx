import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { PasswordSetup } from "./PasswordSetup.tsx";
import { ResetPassword } from "./ResetPassword.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it.each([false, true])("valida después del blur y corrige al escribir (reset=%s)", (reset) => {
  const props = { onClose: vi.fn(), onSubmit: vi.fn(), busy: false, error: "" };
  if (reset) render(<ResetPassword {...props} questions={["Respuesta 1", "Respuesta 2"]} />);
  else render(<PasswordSetup {...props} onBack={vi.fn()} />);
  const password = screen.getByLabelText("Contraseña");
  const confirmation = screen.getByLabelText("Confirmar contraseña");
  const answer = screen.getByLabelText("Respuesta 1");
  for (const field of [password, confirmation, answer]) {
    expect(field).not.toHaveAttribute("aria-invalid");
    fireEvent.change(field, { target: { value: "a" } });
    expect(field).not.toHaveAttribute("aria-invalid");
    fireEvent.blur(field);
    if (field === confirmation) fireEvent.change(field, { target: { value: "b" } });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.parentElement).toHaveClass("border-danger");
    expect(document.getElementById(field.getAttribute("aria-describedby") ?? "")).toBeTruthy();
  }
  expect(screen.getByText(es.vault.answerLength)).toHaveClass("text-danger");
  expect(screen.getByText("○ mayúscula")).toHaveClass("text-danger");
  fireEvent.change(password, { target: { value: "Abcde1!" } });
  fireEvent.change(confirmation, { target: { value: "Abcde1!" } });
  fireEvent.change(answer, { target: { value: "ab" } });
  for (const field of [password, confirmation, answer]) {
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(field.parentElement).not.toHaveClass("border-danger");
  }
  expect(screen.getByText(es.vault.answerLength)).toHaveClass("text-muted");
  const meter = screen.getByRole("meter");
  expect(meter).toHaveAttribute("max", "5");
  expect(meter).toHaveAttribute("value", "5");
  expect(meter.nextElementSibling?.children).toHaveLength(5);
  for (const label of [
    "6 a 10 caracteres",
    "mayúscula",
    "minúscula",
    "número",
    "carácter especial",
  ])
    expect(screen.getByText(`✓ ${label}`)).toHaveClass("text-success");
});

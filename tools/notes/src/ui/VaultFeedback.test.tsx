import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { ResetPassword } from "./ResetPassword.tsx";
import { UnlockPanel } from "./UnlockPanel.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it.each([false, true])("solo responde a fallos del backend (restablecer=%s)", (reset) => {
  const props = { onSubmit: vi.fn(), onClose: vi.fn(), onForgot: vi.fn(), error: "", busy: false };
  const panel = (busy: boolean, error: string) =>
    reset ? (
      <ResetPassword
        {...props}
        busy={busy}
        error={error}
        questions={["Respuesta 1", "Respuesta 2"]}
      />
    ) : (
      <UnlockPanel {...props} busy={busy} error={error} />
    );
  const { rerender } = render(panel(false, ""));
  const input = screen.getByLabelText("Contraseña", { exact: true });
  expect(input.parentElement).toHaveAttribute("data-failure", "0");
  fireEvent.change(input, { target: { value: "a" } });
  fireEvent.blur(input);
  expect(input.parentElement).toHaveAttribute("data-failure", "0");
  for (const count of [1, 2]) {
    rerender(panel(true, ""));
    rerender(panel(false, "error"));
    expect(input.parentElement).toHaveAttribute("data-failure", String(count));
    // Al desbloquear, el campo se desactiva mientras espera y recupera el foco; al restablecer,
    // el foco sigue donde estaba.
    if (!reset) expect(input).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveClass("vault-error");
    fireEvent.change(input, { target: { value: "ab" } });
    expect(input.parentElement).toHaveAttribute("data-failure", String(count));
  }
});
it("limita el movimiento y el fundido a la preferencia permitida", () => {
  const css = readFileSync("tools/notes/src/ui/styles.css", "utf8");
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.secret-field-control\[data-failure[^}]+animation: ld-shake 200ms var\(--ld-ease-out\);/,
  );
  const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)"));
  expect(block).toMatch(
    /\.vault-error\s*\{\s*animation: error-boveda var\(--ld-motion\) var\(--ld-ease-out\);/,
  );
  expect(block).toContain("@keyframes error-boveda");
  expect(readFileSync("packages/sdk/src/theme.css", "utf8")).toContain("--ld-motion: 150ms");
});
it("cuenta un solo fallo aunque los intentos cambien antes de terminar", () => {
  const props = { onSubmit: vi.fn(), onClose: vi.fn(), onForgot: vi.fn() };
  const lockout = (failures: number) =>
    ({
      password: { stage: "normal", failures, retryAt: null },
      recovery: { stage: "normal", failures: 0, retryAt: null },
    }) as never;
  const { rerender } = render(
    <UnlockPanel {...props} busy={false} error="" lockout={lockout(0)} />,
  );
  const input = screen.getByLabelText("Contraseña", { exact: true });
  rerender(<UnlockPanel {...props} busy error="" lockout={lockout(0)} />);
  rerender(<UnlockPanel {...props} busy error="" lockout={lockout(1)} />);
  expect(input.parentElement).toHaveAttribute("data-failure", "0");
  rerender(<UnlockPanel {...props} busy={false} error="error" lockout={lockout(1)} />);
  expect(input.parentElement).toHaveAttribute("data-failure", "1");
});
it("no quita el foco de otro control al fallar", () => {
  const props = { onSubmit: vi.fn(), onClose: vi.fn(), onForgot: vi.fn() };
  const panel = (busy: boolean, error: string) => (
    <ResetPassword
      {...props}
      busy={busy}
      error={error}
      questions={["Respuesta 1", "Respuesta 2"]}
    />
  );
  const { rerender } = render(panel(false, ""));
  const answer = screen.getAllByRole("textbox")[0] as HTMLElement;
  rerender(panel(true, ""));
  answer.focus();
  rerender(panel(false, "error"));
  expect(answer).toHaveFocus();
  expect(screen.getByLabelText("Contraseña", { exact: true }).parentElement).toHaveAttribute(
    "data-failure",
    "1",
  );
});

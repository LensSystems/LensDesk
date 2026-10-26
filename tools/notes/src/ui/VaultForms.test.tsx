import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { CredentialDialog } from "./CredentialDialog.tsx";
import { emptyCredential } from "./credential-block.ts";
import { PasswordSetup } from "./PasswordSetup.tsx";
import { PrivateNotice } from "./PrivateNotice.tsx";
import { UnlockPanel } from "./UnlockPanel.tsx";

beforeAll(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
it("el aviso explica las tres condiciones y permite cancelar o crear", () => {
  const onClose = vi.fn();
  const onContinue = vi.fn();
  render(<PrivateNotice {...{ onClose, onContinue }} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("list")).toHaveTextContent("El título sigue visible");
  expect(screen.getByRole("list")).toHaveTextContent("6 a 10 caracteres");
  expect(screen.getByRole("list")).toHaveTextContent("no se pueden recuperar");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Crear contraseña" }));
  expect(onContinue).toHaveBeenCalledOnce();
});
it("muestra fuerza, confirmación y preguntas distintas; envía sus textos", async () => {
  const onSubmit = vi.fn();
  const onBack = vi.fn();
  render(<PasswordSetup onClose={vi.fn()} {...{ onSubmit, onBack }} busy={false} error="" />);
  const save = screen.getByRole("button", { name: "Guardar y bloquear" });
  expect(save).toBeDisabled();
  fill("Contraseña", "ABCD12!");
  expect(screen.getByText("○ minúscula")).toBeInTheDocument();
  expect(screen.getByRole("meter", { name: "Fuerza de la contraseña" })).toHaveAttribute(
    "value",
    "4",
  );
  fill("Contraseña", "Abcdef1!");
  expect(screen.getByText("✓ 6 a 10 caracteres")).toBeInTheDocument();
  expect(screen.getByText("✓ carácter especial")).toBeInTheDocument();
  expect(screen.getByText("✓ minúscula")).toHaveClass("text-success");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar Contraseña" }));
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar Contraseña" }));
  expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
  fill("Confirmar contraseña", "otra");
  expect(screen.getByText("○ No coinciden")).toHaveClass("text-danger");
  fill("Confirmar contraseña", "Abcdef1!");
  expect(screen.getByText("✓ Coinciden")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Pregunta 1" }), { key: "ArrowDown" });
  const list = await screen.findByRole("listbox");
  expect(within(list).queryByRole("option", { name: "¿En qué ciudad naciste?" })).toBeNull();
  expect(within(list).getAllByRole("option")).toHaveLength(5);
  fireEvent.click(within(list).getByRole("option", { name: "¿Cuál fue tu primer trabajo?" }));
  fill("Respuesta 1", "Uno");
  fill("Respuesta 2", "Dos");
  fireEvent.click(save);
  expect(onSubmit).toHaveBeenCalledWith(
    "Abcdef1!",
    ["¿Cuál fue tu primer trabajo?", "¿En qué ciudad naciste?"],
    ["Uno", "Dos"],
  );
  fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
  expect(onBack).toHaveBeenCalledOnce();
});
it("el panel bloqueado enfoca la contraseña y permite desbloquear", async () => {
  const onSubmit = vi.fn();
  render(
    <UnlockPanel
      onSubmit={onSubmit}
      onForgot={vi.fn()}
      busy={false}
      error="Contraseña incorrecta"
    />,
  );
  expect(screen.getByRole("heading", { name: "Esta nota es privada" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText("Contraseña")).toHaveFocus());
  expect(screen.getByRole("alert")).toHaveTextContent("Contraseña incorrecta");
  fill("Contraseña", "Abcd1!");
  fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
  expect(onSubmit).toHaveBeenCalledWith("Abcd1!");
});
it("añade tipos, enfoca nombres, muestra chips y permite quitar e insertar", async () => {
  const onSave = vi.fn();
  render(<CredentialDialog initial={emptyCredential()} onSave={onSave} onClose={vi.fn()} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Añadir campo" }), { key: "ArrowDown" });
  // Sin rótulo visible «Tipo de campo».
  const menu = await screen.findByRole("menu");
  expect(menu).not.toHaveTextContent("Tipo de campo");
  expect(within(menu).getByRole("menuitem", { name: "Texto simple" })).toBeInTheDocument();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Texto secreto" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Nombre del campo" })).toHaveFocus(),
  );
  expect(screen.getByText("Texto secreto", { selector: "span" })).toHaveClass("bg-warning-soft");
  fill("Nombre del campo", "PIN");
  fill("PIN", "1234");
  expect(screen.getByLabelText("PIN")).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Quitar campo" }));
  expect(screen.queryByLabelText("PIN")).toBeNull();
  fireEvent.keyDown(screen.getByRole("button", { name: "Añadir campo" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Texto simple" }));
  expect(screen.getByText("Texto simple", { selector: "span" })).toHaveClass("bg-accent-soft");
  fill("Nombre del campo", "Servidor");
  fill("Servidor", "local");
  expect(screen.queryByRole("button", { name: "Mostrar Servidor" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Insertar" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ fields: [{ title: "Servidor", value: "local", secret: false }] }),
  );
});

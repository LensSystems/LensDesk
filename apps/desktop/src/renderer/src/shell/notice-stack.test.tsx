import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { HeaderNotices } from "./HeaderNotices.tsx";

const update = { version: "9.0.0", html_url: "https://example.test/release" };
const bridge = {
  invoke: vi.fn(async () => ({ ok: true, data: {} })),
} as unknown as Window["lensdeskHost"];
beforeEach(async () => {
  await rendererI18n.changeLanguage("es");
  useShellStore.setState({
    update,
    dismissedVersion: null,
    toasts: [{ id: 1, kind: "info", message: "Cerrada", closedToolId: "notas" }],
  });
});
afterEach(() => {
  cleanup();
  useShellStore.setState({ update: null, toasts: [] });
});

it("oculta e inhabilita la actualización trasera hasta entrar con puntero o foco", () => {
  const { container } = render(<HeaderNotices bridge={bridge} />);
  const stack = container.querySelector("[data-notice-stack]") as HTMLElement;
  const back = container.querySelector("[data-notice-back]");
  const front = screen.getByRole("button", { name: "Deshacer" });
  expect(back).toHaveAttribute("inert");
  expect(back).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("button", { name: "Ir a Ajustes" })).toBeNull();
  fireEvent.pointerEnter(stack);
  expect(back).not.toHaveAttribute("inert");
  expect(screen.getByRole("button", { name: "Ir a Ajustes" })).toBeInTheDocument();
  fireEvent.focus(front);
  fireEvent.pointerLeave(stack);
  expect(stack).toHaveAttribute("data-expanded", "true");
  fireEvent.blur(front, { relatedTarget: null });
  expect(stack).toHaveAttribute("data-expanded", "false");
  expect(screen.queryByRole("button", { name: "Ir a Ajustes" })).toBeNull();
  fireEvent.focus(front);
  expect(screen.getByRole("button", { name: "Ir a Ajustes" })).toBeInTheDocument();
});

it("mantiene la actualización montada al retirar el aviso delantero", () => {
  const { container } = render(<HeaderNotices bridge={bridge} />);
  const backButton = container.querySelector("[data-notice-back] button");
  expect(backButton).not.toBeNull();
  act(() => useShellStore.setState({ toasts: [] }));
  expect(container.querySelector("[data-notice-stack]")).toBeNull();
  expect(container.querySelector("[data-notice-back]")).toBeNull();
  expect(screen.getByRole("button", { name: "Ir a Ajustes" })).toBe(backButton);
});

it("no deja caducar el aviso mientras la ventana no tiene el foco", () => {
  vi.useFakeTimers();
  try {
    useShellStore.setState({ update: null, toasts: [{ id: 2, kind: "info", message: "Hecho" }] });
    render(<HeaderNotices bridge={bridge} />);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    act(() => vi.advanceTimersByTime(8000));
    expect(useShellStore.getState().toasts).toHaveLength(1);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    act(() => vi.advanceTimersByTime(5500));
    expect(useShellStore.getState().toasts).toHaveLength(0);
  } finally {
    vi.useRealTimers();
  }
});

it("recoge la pila si desaparece el aviso que tenía el foco", () => {
  const { container } = render(<HeaderNotices bridge={bridge} />);
  const stack = container.querySelector("[data-notice-stack]") as HTMLElement;
  const undo = screen.getByRole("button", { name: "Deshacer" });
  undo.focus();
  fireEvent.focus(undo);
  expect(stack).toHaveAttribute("data-expanded", "true");
  act(() =>
    useShellStore.setState({
      toasts: [{ id: 3, kind: "info", message: "Otra", closedToolId: "hash" }],
    }),
  );
  expect(container.querySelector("[data-notice-stack]")).toHaveAttribute("data-expanded", "false");
});

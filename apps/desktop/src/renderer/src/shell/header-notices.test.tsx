import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rendererI18n } from "../i18n.ts";
import { useShellStore } from "../state/store.ts";
import { ClosedTabNotice } from "./ClosedTabNotice.tsx";
import { HeaderNotices } from "./HeaderNotices.tsx";
import { NoticeCapsule } from "./NoticeCapsule.tsx";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockWidths(content: number, viewport: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(content);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(viewport);
}
it("desplaza solo el texto que no cabe, después de 1,5 s, y lo pausa con puntero o foco", () => {
  mockWidths(300, 100);
  const { container } = render(
    <NoticeCapsule text="Texto largo">
      <button type="button">Acción</button>
    </NoticeCapsule>,
  );
  const text = container.querySelector("[data-notice-text]");
  const capsule = container.querySelector("[data-notice-capsule]") as HTMLElement;
  expect(text?.getAttribute("data-moving")).toBe("false");
  act(() => vi.advanceTimersByTime(1499));
  expect(text?.getAttribute("data-moving")).toBe("false");
  act(() => vi.advanceTimersByTime(1));
  expect(text?.getAttribute("data-moving")).toBe("true");
  fireEvent.pointerEnter(capsule);
  expect(text?.getAttribute("data-paused")).toBe("true");
  fireEvent.focus(screen.getByRole("button"));
  fireEvent.pointerLeave(capsule);
  expect(text?.getAttribute("data-paused")).toBe("true");
  fireEvent.blur(screen.getByRole("button"));
  expect(text?.getAttribute("data-paused")).toBe("false");
});
it("mantiene quieto el texto que cabe", () => {
  mockWidths(80, 100);
  const { container } = render(
    <NoticeCapsule text="Texto">
      <span />
    </NoticeCapsule>,
  );
  act(() => vi.advanceTimersByTime(10000));
  expect(container.querySelector("[data-notice-text]")?.getAttribute("data-moving")).toBe("false");
});
it("recorta sin desplazamiento con reducir movimiento", () => {
  mockWidths(300, 100);
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  const { container } = render(
    <NoticeCapsule text="Texto largo">
      <span />
    </NoticeCapsule>,
  );
  act(() => vi.advanceTimersByTime(10000));
  expect(container.querySelector("[data-notice-text]")?.getAttribute("data-moving")).toBe("false");
});
it("conserva el tiempo restante con puntero y foco y desvanece en 200 ms sin ×", () => {
  const remove = vi.fn();
  render(
    <ol>
      <ClosedTabNotice message="Cerrada" onUndo={vi.fn()} onRemove={remove} />
    </ol>,
  );
  const notice = screen.getByRole("status");
  expect(screen.getAllByRole("button")).toHaveLength(1);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.pointerEnter(notice);
  act(() => vi.advanceTimersByTime(10000));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.focus(screen.getByRole("button"));
  fireEvent.pointerLeave(notice);
  act(() => vi.advanceTimersByTime(10000));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.blur(screen.getByRole("button"));
  act(() => vi.advanceTimersByTime(1999));
  expect(notice.style.opacity).toBe("1");
  act(() => vi.advanceTimersByTime(1));
  expect(notice.style.opacity).toBe("0");
  act(() => vi.advanceTimersByTime(200));
  expect(remove).toHaveBeenCalledOnce();
});
it("desaparece sin esperar al desvanecido con reducir movimiento", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  const remove = vi.fn();
  render(
    <ol>
      <ClosedTabNotice message="Cerrada" onUndo={vi.fn()} onRemove={remove} />
    </ol>,
  );
  act(() => vi.advanceTimersByTime(5000));
  act(() => vi.runOnlyPendingTimers());
  expect(remove).toHaveBeenCalledOnce();
});

it("conserva el arranque a los 1,5 s aunque reciba JSX nuevo en cada render", () => {
  mockWidths(300, 100);
  const view = () => (
    <NoticeCapsule text={<span>Texto largo</span>}>
      <span />
    </NoticeCapsule>
  );
  const { container, rerender } = render(view());
  const text = container.querySelector("[data-notice-text]");
  act(() => vi.advanceTimersByTime(1000));
  rerender(view());
  act(() => vi.advanceTimersByTime(499));
  expect(text).toHaveAttribute("data-moving", "false");
  rerender(view());
  act(() => vi.advanceTimersByTime(1));
  expect(text).toHaveAttribute("data-moving", "true");
  rerender(view());
  expect(text).toHaveAttribute("data-moving", "true");
});

it("reinicia la espera cuando cambia el texto del aviso", () => {
  mockWidths(300, 100);
  const { container, rerender } = render(
    <NoticeCapsule text={<span>Primer texto</span>}>
      <span />
    </NoticeCapsule>,
  );
  act(() => vi.advanceTimersByTime(1000));
  rerender(
    <NoticeCapsule text={<span>Otro texto</span>}>
      <span />
    </NoticeCapsule>,
  );
  act(() => vi.advanceTimersByTime(500));
  const text = container.querySelector("[data-notice-text]");
  expect(text).toHaveAttribute("data-moving", "false");
  act(() => vi.advanceTimersByTime(1000));
  expect(text).toHaveAttribute("data-moving", "true");
});

function renderStack() {
  void rendererI18n.changeLanguage("es");
  useShellStore.setState({
    update: { version: "9.1", html_url: "https://example.com" },
    dismissedVersion: null,
    toasts: [
      { id: 900, kind: "success", message: "Listo", closedToolId: "uno", openedToolId: "dos" },
    ],
  });
  return render(
    <HeaderNotices bridge={{ invoke: vi.fn() } as unknown as Window["lensdeskHost"]} />,
  );
}
it("coloca el temporal delante y oculta el anterior hasta entrar con teclado", () => {
  const { container } = renderStack();
  const back = container.querySelector("[data-notice-back]");
  expect(back).toHaveAttribute("inert");
  expect(back).toHaveAttribute("aria-hidden", "true");
  expect(screen.queryByRole("button", { name: "Ir a Ajustes" })).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: "Deshacer" }));
  expect(back).not.toHaveAttribute("inert");
  expect(back).not.toHaveAttribute("aria-hidden");
  expect(screen.getAllByRole("button")[0]).toHaveTextContent("Deshacer");
  expect(screen.getAllByRole("button")[1]).toHaveAccessibleName("Ir a Ajustes");
});
it("pausa el temporal en toda la pila y devuelve la actualización al frente", () => {
  const { container } = renderStack();
  const stack = container.querySelector("[data-notice-stack]") as HTMLElement;
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.pointerEnter(stack);
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  fireEvent.pointerLeave(stack);
  act(() => vi.advanceTimersByTime(2000));
  expect(container.querySelector("[data-closed-notice]")).toHaveAttribute("data-closing", "true");
  act(() => vi.advanceTimersByTime(160));
  expect(container.querySelector("[data-notice-back]")).toBeNull();
  expect(screen.getByRole("button", { name: "Ir a Ajustes" })).toBeInTheDocument();
});
it("lleva al frente una actualización recibida después del temporal", () => {
  const { container } = renderStack();
  act(() =>
    useShellStore.setState({ update: { version: "9.2", html_url: "https://example.com" } }),
  );
  expect(container.querySelector(".ld-notice-front")).toHaveAttribute("data-notice-kind", "update");
  expect(container.querySelector("[data-notice-back]")).toHaveAttribute(
    "data-notice-kind",
    "toast",
  );
});
it("fija geometría y movimiento de la pila solo cuando se permite movimiento", () => {
  const css = readFileSync("apps/desktop/src/renderer/src/styles.css", "utf8");
  expect(css).toMatch(
    /transform-origin: left center;\s*transform: translateX\(-7px\) scale\(0\.94\);/,
  );
  expect(css).toContain("opacity: 0.6");
  expect(css).toContain("filter: blur(1px)");
  const motion = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)"));
  expect(motion).toContain("var(--ld-motion-slow) var(--ld-ease-out)");
  expect(motion).toContain("translateY(8px) scale(0.97)");
  expect(readFileSync("packages/sdk/src/theme.css", "utf8")).toMatch(/--ld-motion-slow:\s*160ms/);
});

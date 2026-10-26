import { readFileSync } from "node:fs";
import { TooltipProvider } from "@lensdesk/ui";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { afterEach, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { Queue } from "./Queue.tsx";
import { QueueCard } from "./QueueCard.tsx";
import { useCompletionMotion } from "./use-completion-motion.ts";
import type { QueueItem } from "./use-queue.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("anima solo los cambios con movimiento permitido y respeta la reducción", () => {
  for (const allowed of [true, false]) {
    vi.stubGlobal("matchMedia", () => ({ matches: allowed }));
    const item = { status: "done", saved: true } as QueueItem;
    const { result, rerender } = renderHook((value) => useCompletionMotion(value), {
      initialProps: item,
    });
    expect(result.current.motion.done).toBe(false);
    expect(result.current.motion.saved).toBe(false);
    rerender({ ...item, status: "converting", saved: false });
    rerender({ ...item, saved: false });
    expect(result.current.motion.done).toBe(allowed);
    expect(!!result.current.motion.old).toBe(allowed);
    act(() => result.current.clearMotion());
    rerender(item);
    expect(result.current.motion.saved).toBe(allowed);
    act(() => result.current.clearMotion());
    expect(result.current.motion.saved).toBe(false);
  }
});
it("limita entrada, salida y trazo a 160 ms con movimiento permitido", () => {
  const tokens = readFileSync("packages/sdk/src/theme.css", "utf8");
  expect(tokens).toContain("--ld-motion-slow: 160ms");
  const css = readFileSync("tools/md-converter/src/ui/styles.css", "utf8");
  const motion = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)"));
  expect(motion).toContain("scale(0.9)");
  expect(motion).toContain("scale(1)");
  expect(motion).toContain("ld-check-draw var(--ld-motion-slow) var(--ld-ease-out)");
  expect(motion).toContain("salida-estado var(--ld-motion-slow) var(--ld-ease-out)");
  expect(motion).toContain("entrada-estado var(--ld-motion-slow) var(--ld-ease-out)");
  expect(css).toMatch(/\.estado-saliente,\s*\.progreso-saliente\s*\{\s*position: absolute;/);
});

it("dibuja la palomita solo al terminar y retira el estado saliente al acabar", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
  const item = {
    id: "uno",
    file: { name: "archivo.html" },
    status: "done",
    progress: 1,
  } as QueueItem;
  const props = { selected: false, onSelect: vi.fn(), onCancel: vi.fn() };
  const { container, rerender } = render(<QueueCard {...props} item={item} />);
  expect(container.querySelector("[data-motion]")).toBeNull();
  rerender(<QueueCard {...props} item={{ ...item, status: "converting", progress: 0.72 }} />);
  rerender(<QueueCard {...props} item={item} />);
  const result = container.querySelector(".queue-result-status") as HTMLElement;
  expect(result).toHaveAttribute("data-motion", "on");
  expect(result.querySelector("path, polyline")).toHaveAttribute("pathLength", "1");
  expect(container.querySelector(".estado-saliente")).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector(".progreso-saliente")).not.toBeNull();
  fireEvent(result, new Event("webkitAnimationEnd", { bubbles: true }));
  expect(container.querySelector(".estado-saliente")).toBeNull();
  expect(result).not.toHaveAttribute("data-motion");
  rerender(<QueueCard {...props} item={{ ...item, saved: true }} />);
  expect(container.querySelector(".saved-indicator")).toHaveAttribute("data-motion", "on");
});
it("el contador de la cola oculta la cifra saliente y selecciona la duración rápida", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
  const item = {
    id: "uno",
    file: { name: "archivo.html" },
    status: "done",
    progress: 1,
  } as QueueItem;
  const props = {
    selectedId: null,
    onChoose: vi.fn(),
    onSelect: vi.fn(),
    onCancel: vi.fn(),
    onClear: vi.fn(),
  };
  const { container, rerender } = render(
    <TooltipProvider>
      <Queue {...props} items={[item]} />
    </TooltipProvider>,
  );
  rerender(
    <TooltipProvider>
      <Queue {...props} items={[item, { ...item, id: "dos" }]} />
    </TooltipProvider>,
  );
  const counter = container.querySelector(".queue-heading [data-speed=fast]") as HTMLElement;
  expect(counter).not.toBeNull();
  expect(counter.querySelector(".ld-swap-old")).toHaveTextContent("1");
  expect(counter.querySelector(".ld-swap-old")).toHaveAttribute("aria-hidden", "true");
  expect(counter.querySelector(".ld-swap-old")).toHaveAttribute("inert");
  expect(counter.querySelector("[data-swap-new]")).toHaveTextContent("2");
});

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { squeezeActiveTab, tabInsets, useCompactTabs, useTabCenter } from "./use-tab-layout.ts";

describe("distribución de pestañas", () => {
  it("centra la tira cuando cabe completa, incluido el límite exacto", () => {
    expect(tabInsets(900, 200, 320, 260)).toEqual({ left: 320, right: 320 });
  });

  it("usa todo el espacio libre cuando el centrado recortaría la activa", () => {
    expect(tabInsets(900, 200, 320, 350)).toEqual({ left: 200, right: 320 });
  });

  it("vuelve al centro al desaparecer el aviso sin cambiar el ancho natural", () => {
    expect(tabInsets(900, 200, 80, 350)).toEqual({ left: 200, right: 200 });
  });
});

for (const [width, activeIndex, compact, required] of [
  [760, 0, true, 235],
  [760, -1, true, 74],
  [900, 0, false, 396],
  [1280, 0, false, 396],
] as const) {
  it(`calcula la tira a ${width}px con activa ${activeIndex}`, () => {
    const { result } = renderHook(() =>
      useCompactTabs({ current: null }, ["Notas", "Convertidor"], activeIndex, 1000, width),
    );
    expect(result.current).toEqual({ compact, required, compactRequired: 74 });
  });
}
it("usa 31 px por compacta al faltar espacio en una ventana amplia", () => {
  const { result } = renderHook(() =>
    useCompactTabs({ current: null }, ["Notas", "Convertidor"], 1, 250, 1280),
  );
  expect(result.current).toEqual({ compact: true, required: 235, compactRequired: 74 });
});

it.each([false, true])("reserva solo el texto delantero, con aviso trasero %s", (withBack) => {
  let measure: (() => void) | undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        measure = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const header = document.createElement("header");
  header.dataset.hasNotice = "true";
  const brand = document.createElement("div");
  const actions = document.createElement("div");
  actions.innerHTML = "<span data-notice-text><span data-notice-copy>Delante</span></span>";
  header.style.paddingRight = "154px";
  actions.style.columnGap = "4px";
  actions.innerHTML =
    '<div style="margin-right:4px"><div class="ld-notice-front"><div data-notice-capsule style="padding:0 4px 0 12px;column-gap:4px">' +
    actions.innerHTML +
    "<button data-fixed></button><button data-fixed></button></div></div></div><button data-fixed></button><button data-fixed></button>";
  if (withBack)
    actions.firstElementChild?.insertAdjacentHTML(
      "beforeend",
      "<div data-notice-back inert><span data-notice-text><span data-notice-copy>Detrás</span></span></div>",
    );
  const fixedWidths = [80, 24, 32, 32];
  actions.querySelectorAll<HTMLElement>("[data-fixed]").forEach((node, index) => {
    node.getBoundingClientRect = () => ({ width: fixedWidths[index] }) as DOMRect;
  });
  header.getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000 }) as DOMRect;
  brand.getBoundingClientRect = () => ({ right: 100 }) as DOMRect;
  actions.getBoundingClientRect = () => ({ left: 700 }) as DOMRect;
  for (const node of actions.querySelectorAll<HTMLElement>("[data-notice-text]")) {
    Object.defineProperty(node, "clientWidth", { value: 40 });
    const copy = node.firstElementChild as HTMLElement;
    Object.defineProperty(copy, "scrollWidth", {
      value: node.closest("[data-notice-back]") ? 900 : 100,
    });
  }
  try {
    const { result, unmount } = renderHook(() => {
      const layout = useTabCenter();
      layout.headerRef.current = header;
      layout.brandRef.current = brand;
      layout.actionsRef.current = actions;
      return layout;
    });
    act(() => measure?.());
    expect(result.current.minRight).toBe(398);
    actions.getBoundingClientRect = () => ({ left: 800 }) as DOMRect;
    act(() => measure?.());
    expect(result.current.minRight).toBe(398);
    actions.getBoundingClientRect = () => ({ left: 700 }) as DOMRect;
    act(() => measure?.());
    expect(result.current.right).toBe(312);
    expect(result.current.naturalRight).toBe(372);
    unmount();
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("activa compacta con aviso", () => {
  it.each([
    [true, 760, 50, 350, 380, true],
    [true, 760, 50, 318, 380, false],
    [true, 760, 50, 319, 380, true],
    [false, 760, 50, 400, 380, false],
    [true, 1100, 100, 300, 380, false],
  ])(
    "decide con aviso %s, ancho %s y mínimo %s/%s/%s",
    (hasNotice, width, left, minRight, required, expected) => {
      expect(squeezeActiveTab({ hasNotice, width, left, minRight, required })).toBe(expected);
    },
  );
});

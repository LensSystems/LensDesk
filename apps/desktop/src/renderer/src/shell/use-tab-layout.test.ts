import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tabInsets, useCompactTabs } from "./use-tab-layout.ts";

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
    expect(result.current).toEqual({ compact, required });
  });
}
it("usa 31 px por compacta al faltar espacio en una ventana amplia", () => {
  const { result } = renderHook(() =>
    useCompactTabs({ current: null }, ["Notas", "Convertidor"], 1, 250, 1280),
  );
  expect(result.current).toEqual({ compact: true, required: 235 });
});

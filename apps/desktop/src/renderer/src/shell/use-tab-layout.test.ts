import { describe, expect, it } from "vitest";
import { tabInsets } from "./use-tab-layout.ts";

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

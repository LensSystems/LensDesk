import { describe, expect, it } from "vitest";
import type { Bitmap } from "../../scripts/screenshot-images.ts";
import { composeBitmaps, differentPixels } from "../../scripts/screenshot-images.ts";

const bitmap = (width: number, height: number, value = 0): Bitmap => ({
  width,
  height,
  data: new Uint8Array(width * height * 4).fill(value),
});

describe("bitmaps de capturas", () => {
  it("superpone filas en la posición indicada sin modificar los originales", () => {
    const shell = bitmap(4, 3);
    const view = bitmap(2, 2, 127);
    const result = composeBitmaps(shell, view, 1, 1);
    expect([...result.data]).toEqual([
      ...new Uint8Array(20),
      ...new Uint8Array(8).fill(127),
      ...new Uint8Array(8),
      ...new Uint8Array(8).fill(127),
      ...new Uint8Array(4),
    ]);
    expect(shell.data.every((value) => value === 0)).toBe(true);
    expect(differentPixels(shell, result)).toBe(4);
  });
  it("recorta vistas que sobresalen, incluso con coordenadas negativas", () => {
    expect(
      differentPixels(bitmap(2, 2), composeBitmaps(bitmap(2, 2), bitmap(2, 2, 1), -1, -1)),
    ).toBe(1);
    expect(differentPixels(bitmap(2, 2), composeBitmaps(bitmap(2, 2), bitmap(2, 2, 1), 1, 1))).toBe(
      1,
    );
    expect(differentPixels(bitmap(2, 2), composeBitmaps(bitmap(2, 2), bitmap(2, 2, 1), 3, 0))).toBe(
      0,
    );
  });
  it("cuenta píxeles, incluidos alfa y tamaños distintos", () => {
    const a = bitmap(2, 1);
    const b = bitmap(2, 1);
    b.data.set([1, 2, 3, 4]);
    expect(differentPixels(a, b)).toBe(1);
    expect(differentPixels(a, a)).toBe(0);
    expect(differentPixels(bitmap(2, 1), bitmap(1, 2))).toBe(2);
  });
  it("detecta un cambio en cualquiera de los cuatro canales por separado", () => {
    for (const channel of [0, 1, 2, 3]) {
      const changed = bitmap(1, 1);
      changed.data[channel] = 1;
      expect(differentPixels(bitmap(1, 1), changed)).toBe(1);
    }
  });
  it("rechaza dimensiones y buffers inválidos", () => {
    expect(() => differentPixels(bitmap(0, 1), bitmap(1, 1))).toThrow("Bitmap inválido");
    expect(() =>
      composeBitmaps({ width: 2, height: 2, data: new Uint8Array(1) }, bitmap(1, 1), 0, 0),
    ).toThrow("Bitmap inválido");
    expect(() => composeBitmaps(bitmap(1, 1), bitmap(1, 1), 0.5, 0)).toThrow("Posición inválida");
  });
});

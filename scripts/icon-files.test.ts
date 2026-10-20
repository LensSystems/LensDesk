import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIco, iconSizes, iconSource, iconsetFiles, icoSizes } from "./icon-files.ts";

function checkIco(ico: Buffer, payloads?: ReadonlyMap<number, Buffer>) {
  expect(ico.readUInt16LE(0)).toBe(0);
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(6);
  let offset = 102;
  icoSizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    expect(ico[entry]).toBe(size === 256 ? 0 : size);
    expect(ico[entry + 1]).toBe(size === 256 ? 0 : size);
    expect(ico.readUInt16LE(entry + 4)).toBe(1);
    expect(ico.readUInt16LE(entry + 6)).toBe(32);
    expect(ico.readUInt32LE(entry + 12)).toBe(offset);
    const length = ico.readUInt32LE(entry + 8);
    expect(length).toBeGreaterThan(0);
    if (payloads) expect(ico.subarray(offset, offset + length)).toEqual(payloads.get(size));
    offset += length;
  });
  expect(offset).toBe(ico.length);
}

describe("archivos de iconos", () => {
  it("enumera los tamaños y elige la geometría por píxeles reales", () => {
    expect(iconSizes).toEqual([16, 32, 48, 64, 128, 256, 512, 1024]);
    expect(iconSizes.map(iconSource)).toEqual([
      "icon-16.svg",
      "icon-32.svg",
      ...Array(6).fill("icon.svg"),
    ]);
  });
  it("arma ICONDIR y las seis entradas con sus PNG consecutivos", () => {
    const images = new Map(icoSizes.map((size) => [size, Buffer.alloc(size, size % 256)]));
    checkIco(buildIco(images), images);
    expect(() => buildIco(new Map())).toThrow("Falta PNG");
  });
  it("nombra el iconset con dimensiones físicas y representaciones dobles", () => {
    expect(iconsetFiles).toEqual([
      { name: "icon_16x16.png", size: 16 },
      { name: "icon_16x16@2x.png", size: 32 },
      { name: "icon_32x32.png", size: 32 },
      { name: "icon_32x32@2x.png", size: 64 },
      { name: "icon_128x128.png", size: 128 },
      { name: "icon_128x128@2x.png", size: 256 },
      { name: "icon_256x256.png", size: 256 },
      { name: "icon_256x256@2x.png", size: 512 },
      { name: "icon_512x512.png", size: 512 },
      { name: "icon_512x512@2x.png", size: 1024 },
    ]);
  });
  it("incluye los binarios versionados PNG, ICO e ICNS", () => {
    const directory = resolve(import.meta.dirname, "../apps/desktop/build");
    const png = readFileSync(resolve(directory, "icon.png"));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 1024]);
    checkIco(readFileSync(resolve(directory, "icon.ico")));
    expect(readFileSync(resolve(directory, "icon.icns")).toString("ascii", 0, 4)).toBe("icns");
  });
});

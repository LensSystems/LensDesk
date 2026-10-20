export const iconSizes = [16, 32, 48, 64, 128, 256, 512, 1024] as const;
export const icoSizes = [16, 32, 48, 64, 128, 256] as const;

export function iconSource(size: number): string {
  return size <= 16 ? "icon-16.svg" : size <= 32 ? "icon-32.svg" : "icon.svg";
}

export const iconsetFiles = [16, 32, 128, 256, 512].flatMap((size) => [
  { name: `icon_${size}x${size}.png`, size },
  { name: `icon_${size}x${size}@2x.png`, size: size * 2 },
]);

export function buildIco(images: ReadonlyMap<number, Buffer>): Buffer {
  const directory = Buffer.alloc(6 + icoSizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(icoSizes.length, 4);
  let offset = directory.length;
  const payloads = icoSizes.map((size, index) => {
    const png = images.get(size);
    if (!png) throw new Error(`Falta PNG de ${size} px`);
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
    return png;
  });
  return Buffer.concat([directory, ...payloads]);
}

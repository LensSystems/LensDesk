export type Bitmap = { width: number; height: number; data: Uint8Array };

function validate(image: Bitmap): void {
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length !== image.width * image.height * 4
  )
    throw new Error("Bitmap inválido");
}

export function composeBitmaps(shell: Bitmap, view: Bitmap, x: number, y: number): Bitmap {
  validate(shell);
  validate(view);
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error("Posición inválida");
  const data = new Uint8Array(shell.data);
  const left = Math.max(0, x);
  const right = Math.min(shell.width, x + view.width);
  for (let row = Math.max(0, y); row < Math.min(shell.height, y + view.height); row++) {
    if (right <= left) break;
    const start = ((row - y) * view.width + left - x) * 4;
    data.set(view.data.subarray(start, start + (right - left) * 4), (row * shell.width + left) * 4);
  }
  return { width: shell.width, height: shell.height, data };
}

export function differentPixels(a: Bitmap, b: Bitmap): number {
  validate(a);
  validate(b);
  let count = 0;
  for (let y = 0; y < Math.max(a.height, b.height); y++) {
    for (let x = 0; x < Math.max(a.width, b.width); x++) {
      const inA = x < a.width && y < a.height;
      const inB = x < b.width && y < b.height;
      if (!inA && !inB) continue;
      if (!inA || !inB) {
        count++;
        continue;
      }
      const ai = (y * a.width + x) * 4;
      const bi = (y * b.width + x) * 4;
      if (
        a.data[ai] !== b.data[bi] ||
        a.data[ai + 1] !== b.data[bi + 1] ||
        a.data[ai + 2] !== b.data[bi + 2] ||
        a.data[ai + 3] !== b.data[bi + 3]
      )
        count++;
    }
  }
  return count;
}

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportLogs } from "./export.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Lee los nombres del directorio central del zip, sin dependencias.
function zipEntries(file: string): string[] {
  const data = readFileSync(file);
  const names: string[] = [];
  for (let offset = 0; offset + 46 <= data.length; offset++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = data.readUInt16LE(offset + 28);
    names.push(data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
  }
  return names.sort();
}

describe("exportLogs", () => {
  it("guarda en la ruta elegida un zip con los archivos de registro", async () => {
    const root = mkdtempSync(join(tmpdir(), "lensdesk-export-"));
    dirs.push(root);
    const logsDir = join(root, "logs");
    mkdirSync(logsDir);
    writeFileSync(join(logsDir, "lensdesk.log"), '{"event":"a"}\n');
    writeFileSync(join(logsDir, "lensdesk.1.log"), '{"event":"b"}\n');
    const outFile = join(root, "elegido.zip");
    await exportLogs({ logsDir, outFile });
    expect(readFileSync(outFile).subarray(0, 2).toString()).toBe("PK");
    expect(zipEntries(outFile)).toEqual(["lensdesk.1.log", "lensdesk.log"]);
  });

  it("crea el directorio si aún no hay registros", async () => {
    const root = mkdtempSync(join(tmpdir(), "lensdesk-export-"));
    dirs.push(root);
    const outFile = join(root, "vacio.zip");
    await exportLogs({ logsDir: join(root, "logs"), outFile });
    expect(zipEntries(outFile)).toEqual([]);
  });
});

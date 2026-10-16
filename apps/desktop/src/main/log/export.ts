import { mkdir } from "node:fs/promises";
import { zipDirectory } from "@lensdesk/lenspkg";

// Empaqueta en un zip todos los archivos de registro. El directorio se crea si aún no existe, para
// que exportar sin registros produzca un zip vacío en lugar de un error.
export async function exportLogs(options: {
  logsDir: string;
  outFile: string;
  zip?: (dir: string, outFile: string) => Promise<void>;
}): Promise<void> {
  await mkdir(options.logsDir, { recursive: true });
  await (options.zip ?? zipDirectory)(options.logsDir, options.outFile);
}

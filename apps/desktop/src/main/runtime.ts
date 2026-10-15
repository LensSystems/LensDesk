import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type SmokeProbe = (window: {
  webContents: { executeJavaScript: (code: string) => Promise<unknown> };
}) => Promise<boolean>;

export function configureRuntime(
  args: string[],
  userData: string | undefined,
  setUserDataPath: (path: string) => void,
): boolean {
  const smoke = args.includes("--smoke");
  const path = userData ?? (smoke ? mkdtempSync(join(tmpdir(), "lensdesk-smoke-")) : undefined);
  if (path) setUserDataPath(path);
  return smoke;
}

export async function runSmoke(
  probe: SmokeProbe,
  window: Parameters<SmokeProbe>[0],
  version: string,
  write: (line: string) => void,
  exit: (code: number) => void,
  checks: {
    database?: () => boolean;
    ftsMain?: () => boolean;
    ftsUtility?: () => Promise<boolean>;
    tools?: () => boolean;
  } = {},
): Promise<void> {
  try {
    if (!(await probe(window))) {
      exit(1);
      return;
    }
    write(`LENSDESK_SMOKE_OK ${version}`);
    if (checks.database) {
      if (!checks.database()) throw new Error("La base no contiene el esquema esperado.");
      write("LENSDESK_SMOKE_DB_OK");
    }
    if (checks.ftsMain) {
      if (!checks.ftsMain()) throw new Error("FTS5 no está disponible en main.");
      write("LENSDESK_SMOKE_FTS5_MAIN_OK");
    }
    if (checks.ftsUtility) {
      if (!(await checks.ftsUtility()))
        throw new Error("FTS5 no está disponible en utilityProcess.");
      write("LENSDESK_SMOKE_FTS5_UTILITY_OK");
    }
    if (checks.tools) {
      if (!checks.tools()) throw new Error("El registro de herramientas no está disponible.");
      write("LENSDESK_SMOKE_TOOLS_OK");
    }
    exit(0);
  } catch {
    exit(1);
  }
}

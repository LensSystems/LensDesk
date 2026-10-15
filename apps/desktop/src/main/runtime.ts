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
): Promise<void> {
  try {
    if (!(await probe(window))) {
      exit(1);
      return;
    }
    write(`LENSDESK_SMOKE_OK ${version}`);
    exit(0);
  } catch {
    exit(1);
  }
}

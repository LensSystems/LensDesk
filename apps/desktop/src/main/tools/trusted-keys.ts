import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

// Sin empaquetar, main se ejecuta desde out/main/ y las claves están en resources/keys.
export function trustedKeysDirectory(options: {
  isPackaged: boolean;
  resourcesPath: string;
  mainDirectory: string;
}): string {
  return options.isPackaged
    ? join(options.resourcesPath, "keys")
    : join(options.mainDirectory, "../../resources/keys");
}

export function loadTrustedKeys(options: {
  directory: string;
  developerMode: boolean;
  readDirectory?: typeof readdirSync;
  readFile?: typeof readFileSync;
}): Map<string, string> {
  const keys = new Map<string, string>();
  const readDirectory = options.readDirectory ?? readdirSync;
  const readFile = options.readFile ?? readFileSync;
  let files: string[];
  try {
    files = readDirectory(options.directory, { encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return keys;
    throw error;
  }
  for (const file of files) {
    if (extname(file) !== ".pub") continue;
    const keyId = basename(file, ".pub");
    if (keyId === "dev" && !options.developerMode) continue;
    keys.set(keyId, readFile(join(options.directory, file), "utf8"));
  }
  return keys;
}

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { trustedKeysDirectory } from "./trusted-keys.ts";

const desktop = resolve(import.meta.dirname, "../../..");

describe("trustedKeysDirectory", () => {
  it("sin empaquetar encuentra las claves desde out/main", () => {
    const directory = trustedKeysDirectory({
      isPackaged: false,
      resourcesPath: "/no/usado",
      mainDirectory: join(desktop, "out/main"),
    });
    expect(directory).toBe(join(desktop, "resources/keys"));
    expect(existsSync(join(directory, "release.pub"))).toBe(true);
  });

  it("empaquetada usa la carpeta keys de los recursos", () => {
    expect(
      trustedKeysDirectory({
        isPackaged: true,
        resourcesPath: "/App/Contents/Resources",
        mainDirectory: "/no/usado",
      }),
    ).toBe(join("/App/Contents/Resources", "keys"));
  });
});

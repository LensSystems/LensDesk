import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { checkSingleInstance } from "./single-instance-check.ts";

const require = createRequire(import.meta.url);

test("el segundo arranque termina y restaura la única ventana", async () => {
  await checkSingleInstance(require("electron") as string, [
    resolve(import.meta.dirname, "../../apps/desktop"),
  ]);
});

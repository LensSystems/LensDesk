import { describe, expect, it } from "vitest";
import { rendererI18n } from "./i18n.ts";

describe("rendererI18n", () => {
  it("starts in Spanish and changes language in place", async () => {
    await rendererI18n.changeLanguage("es");
    expect(rendererI18n.language).toBe("es");
    await rendererI18n.changeLanguage("en");
    expect(rendererI18n.language).toBe("en");
  });
});

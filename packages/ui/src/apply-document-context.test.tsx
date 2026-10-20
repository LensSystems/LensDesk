import { describe, expect, it } from "vitest";
import { applyDocumentContext } from "./apply-document-context.ts";

describe("applyDocumentContext", () => {
  it("aplica el contexto y elimina el acento para azul o un host antiguo", () => {
    const root = document.createElement("html");
    applyDocumentContext({ locale: "en", theme: "light", accent: "green" }, root);
    expect(root.dataset.theme).toBe("light");
    expect(root.lang).toBe("en");
    expect(root.dataset.accent).toBe("green");
    applyDocumentContext({ locale: "es", theme: "dark", accent: "blue" }, root);
    expect(root.hasAttribute("data-accent")).toBe(false);
    applyDocumentContext({ locale: "es", theme: "dark", accent: "green" }, root);
    applyDocumentContext({ locale: "es", theme: "dark" }, root);
    expect(root.hasAttribute("data-accent")).toBe(false);
  });
});

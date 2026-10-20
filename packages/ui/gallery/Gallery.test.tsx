import * as ui from "@lensdesk/ui";
import { render } from "@testing-library/react";
import * as icons from "lucide-react";
import { describe, expect, it } from "vitest";
import { Gallery } from "./Gallery.tsx";

describe("galería", () => {
  it("incluye cada componente público en ambos temas", () => {
    const { container } = render(<Gallery />);
    const iconExports = new Set<unknown>(Object.values(icons));
    const components = Object.entries(ui).filter(
      ([name, value]) =>
        name !== "cn" &&
        name !== "applyDocumentContext" &&
        name !== "UiLabelsProvider" &&
        !iconExports.has(value) &&
        (typeof value === "function" ||
          (typeof value === "object" && value !== null && "$$typeof" in value)),
    );
    expect(components.length).toBeGreaterThan(0);
    for (const theme of ["light", "dark"]) {
      const column = container.querySelector(`[data-theme="${theme}"]`);
      for (const [name] of components) {
        expect(column?.querySelector(`[data-component="${name}"]`), name).toBeTruthy();
      }
    }
  });
});

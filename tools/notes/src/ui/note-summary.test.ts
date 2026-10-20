import { describe, expect, it } from "vitest";
import { noteSummary } from "./note-summary.ts";

describe("resumen de nota", () => {
  it.each([
    ["# Título", "Título", ""],
    ["", "Título", ""],
    ["# Título\n\n- **Texto** con `código`", "Título", "Texto con código"],
    ["# Título\n> ## Resumen", "Título", "Resumen"],
    ["# Título\n`Código`", "Título", "Código"],
  ])("extrae texto de %s", (body, title, expected) => {
    expect(noteSummary(body, title)).toBe(expected);
  });
});

it("elige la primera línea limpia que coincide o conserva el resumen", () => {
  const body = "# Título\nResumen habitual\n- **Café** pendiente\nCafé final";
  expect(noteSummary(body, "Título", "caf")).toBe("Café pendiente");
  expect(noteSummary(body, "Título", "titulo")).toBe("Resumen habitual");
  expect(noteSummary(body, "Título", "ausente")).toBe("Resumen habitual");
  expect(noteSummary(body, "Título", "  ")).toBe("Resumen habitual");
});

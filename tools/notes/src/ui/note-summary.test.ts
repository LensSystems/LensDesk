import { describe, expect, it } from "vitest";
import { noteSummary } from "./note-summary.ts";

describe("resumen de nota", () => {
  it.each([
    ["# Título", "Título", "Título"],
    ["", "Título", ""],
    ["\n- **Texto** con `código`", "Título", "Texto con código"],
    ["> ## Resumen", "Título", "Resumen"],
    ["`Código`", "Título", "Código"],
  ])("extrae texto de %s", (body, title, expected) => {
    expect(noteSummary(body, title)).toBe(expected);
  });
});

it("elige la primera línea limpia que coincide o conserva el resumen", () => {
  const body = "# Título\nResumen habitual\n- **Café** pendiente\nCafé final";
  expect(noteSummary(body, "Título", "caf")).toBe("Café pendiente");
  expect(noteSummary(body, "Título", "titulo")).toBe("Título");
  expect(noteSummary(body, "Título", "ausente")).toBe("Título");
  expect(noteSummary(body, "Título", "  ")).toBe("Resumen habitual, Café pendiente, Café final");
});

it.each([
  [
    "## Pasos\n1. Congelar la rama develop\n2. Ejecutar la compuerta completa",
    "Congelar la rama develop, Ejecutar la compuerta completa",
  ],
  [
    "# Título\n- [x] **Hecho**\n- [ ] _Pendiente_\n> Cita\n* Lista\n```ts\ncódigo oculto\n```\nTexto",
    "Hecho, Pendiente, Cita, Lista, Texto",
  ],
  ["# Primero\n## Segundo", "Primero"],
])("compone el extracto de %s", (body, expected) => {
  expect(noteSummary(body, "Título")).toBe(expected);
});
it("limita el extracto a 120 caracteres", () => {
  expect(noteSummary("a".repeat(150), "")).toHaveLength(120);
});

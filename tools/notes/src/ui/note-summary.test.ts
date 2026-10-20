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

import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PageFrame } from "./PageFrame.tsx";

it("lleva el foco al título al montar una página", () => {
  render(
    <PageFrame>
      <h1>Herramientas</h1>
      <button type="button">Agregar</button>
    </PageFrame>,
  );
  expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
});

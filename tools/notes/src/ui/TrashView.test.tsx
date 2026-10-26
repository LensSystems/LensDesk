import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeAll, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { TrashView } from "./TrashView.tsx";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});
it("mantiene la cabecera de nota y la acción a la derecha en la papelera", () => {
  render(
    <TrashView
      note={{
        id: "1",
        title: "Eliminada",
        body_md: "",
        pinned: false,
        created_at: "now",
        updated_at: "now",
        deleted_at: "now",
      }}
      onRestore={vi.fn()}
      onCopyCode={vi.fn()}
    />,
  );
  const heading = screen.getByRole("heading", { name: "Eliminada" });
  expect(heading).toHaveClass(
    "min-w-0",
    "flex-1",
    "truncate",
    "text-[18px]",
    "leading-7",
    "font-bold",
  );
  expect(heading.parentElement).toHaveClass(
    "flex",
    "min-w-0",
    "shrink-0",
    "items-center",
    "gap-2",
    "border-b",
    "border-border",
    "px-4",
    "py-3",
    "h-[57px]",
    "@max-[960px]/notes:h-[51px]",
    "@max-[960px]/notes:gap-1",
    "@max-[960px]/notes:py-2",
    "@max-[960px]/notes:pr-2",
  );
  expect(screen.getByRole("button", { name: "Restaurar" })).toHaveClass("shrink-0");
});

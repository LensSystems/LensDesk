import { TooltipProvider } from "@lensdesk/ui";
import { act, fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { beforeEach, expect, it, vi } from "vitest";
import es from "../../locales/es.json";
import { QueueCard } from "./QueueCard.tsx";
import type { QueueItem, QueueStatus } from "./use-queue.ts";

beforeEach(async () => {
  await i18n.use(initReactI18next).init({ lng: "es", resources: { es: { translation: es } } });
});

const name = `${"informe-de-documentacion-".repeat(5)}final.html`;
function setup(status: QueueStatus) {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  const item: QueueItem = {
    id: "sample",
    file: { token: "synthetic", name, size: 1024 },
    status,
    progress: 0,
    markdown: "",
    warnings: [],
    errorCode: status === "error" ? "E_INTERNAL" : "E_CANCELLED",
  };
  render(
    <TooltipProvider>
      <ul>
        <QueueCard item={item} selected={false} onSelect={onSelect} onCancel={onCancel} />
      </ul>
    </TooltipProvider>,
  );
  return { onSelect, onCancel };
}

it.each(["queued", "converting", "error", "cancelled"] as const)(
  "permite enfocar la información %s sin habilitar la selección",
  (status) => {
    const { onSelect } = setup(status);
    const row = screen.getByRole("listitem", { name: `${name}, ${es.status[status]}` });
    expect(row).toHaveAttribute("tabindex", "0");
    act(() => row.focus());
    expect(row).toHaveFocus();
    const selection = screen.getByRole("button", { name });
    expect(selection).toBeDisabled();
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    fireEvent.click(selection);
    expect(onSelect).not.toHaveBeenCalled();
  },
);

it("conserva la selección disponible y evita una parada informativa redundante", () => {
  const { onSelect } = setup("done");
  expect(screen.getByRole("listitem")).not.toHaveAttribute("tabindex");
  const selection = screen.getByRole("button", { name });
  expect(selection).toBeEnabled();
  fireEvent.click(selection);
  expect(onSelect).toHaveBeenCalledWith("sample");
});

it("mantiene la cancelación independiente del foco informativo", () => {
  const { onCancel, onSelect } = setup("queued");
  fireEvent.click(screen.getByRole("button", { name: `Cancelar conversión de ${name}` }));
  expect(onCancel).toHaveBeenCalledWith("sample");
  expect(onSelect).not.toHaveBeenCalled();
});

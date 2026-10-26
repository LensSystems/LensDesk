import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Skeleton } from "./Skeleton.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("no muestra bloques ni fundido para una carga de 100 ms", () => {
  vi.useFakeTimers();
  const { rerender, container } = render(
    <Skeleton loading label="Cargando notas…">
      <div>Contenido</div>
    </Skeleton>,
  );
  act(() => vi.advanceTimersByTime(100));
  expect(screen.queryByRole("status")).toBeNull();
  expect(container).toBeEmptyDOMElement();
  rerender(
    <Skeleton loading={false} label="Cargando notas…">
      <div>Contenido</div>
    </Skeleton>,
  );
  expect(screen.getByText("Contenido")).not.toHaveClass("ld-carga-entrada");
});

it("muestra bloques accesibles tras 200 ms y fundido al terminar a los 500 ms", () => {
  vi.useFakeTimers();
  const { rerender, container } = render(
    <Skeleton loading label="Cargando…">
      <div className="original">Contenido</div>
    </Skeleton>,
  );
  act(() => vi.advanceTimersByTime(199));
  expect(screen.queryByRole("status")).toBeNull();
  act(() => vi.advanceTimersByTime(301));
  expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  expect(container.querySelector(".ld-esqueleto-bloques")).toHaveAttribute("aria-hidden", "true");
  rerender(
    <Skeleton loading={false} label="Cargando…">
      <div className="original">Contenido</div>
    </Skeleton>,
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText("Contenido")).toHaveClass("original", "ld-carga-entrada");
  act(() => vi.advanceTimersByTime(160));
  expect(screen.getByText("Contenido")).toHaveAttribute("class", "original");
});

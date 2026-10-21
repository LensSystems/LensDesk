import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { tabDropIndex, useTabDrag } from "./use-tab-drag.ts";

describe("tabDropIndex", () => {
  it("calcula inicio, huecos y final a partir de los centros restantes", () => {
    expect(tabDropIndex(0, [20, 60])).toBe(0);
    expect(tabDropIndex(40, [20, 60])).toBe(1);
    expect(tabDropIndex(80, [20, 60])).toBe(2);
    expect(tabDropIndex(20, [20, 60])).toBe(1);
    expect(tabDropIndex(0, [])).toBe(0);
  });
});

it("captura el puntero, respeta el umbral y cancela sin mover", () => {
  const move = vi.fn();
  const { result } = renderHook(() => useTabDrag(move));
  const button = document.createElement("button");
  button.setPointerCapture = vi.fn();
  button.releasePointerCapture = vi.fn();
  const event = (x: number) =>
    ({
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: x,
      clientY: 0,
      currentTarget: button,
    }) as unknown as PointerEvent<HTMLButtonElement>;
  act(() => result.current.onPointerDown(event(0), "notes"));
  expect(button.setPointerCapture).toHaveBeenCalledWith(1);
  act(() => result.current.onPointerMove(event(3)));
  expect(result.current.drop).toBeNull();
  act(() => result.current.onPointerUp(event(3)));
  expect(move).not.toHaveBeenCalled();
  expect(result.current.consumeClick()).toBe(false);
  act(() => result.current.onPointerDown(event(0), "notes"));
  act(() => result.current.onPointerMove(event(4)));
  expect(result.current.drop).toEqual({ toolId: "notes", index: 0 });
  act(() => result.current.onPointerUp(event(4)));
  expect(move).toHaveBeenCalledExactlyOnceWith("notes", 0);
  expect(result.current.consumeClick()).toBe(true);
  expect(result.current.consumeClick()).toBe(false);
  move.mockClear();
  act(() => result.current.onPointerDown(event(0), "notes"));
  act(() => result.current.onPointerMove(event(8)));
  act(() => result.current.onPointerCancel());
  act(() => result.current.onPointerUp(event(8)));
  expect(result.current.drop).toBeNull();
  expect(move).not.toHaveBeenCalled();
});

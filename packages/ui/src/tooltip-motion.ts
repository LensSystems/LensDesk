import { createContext, useContext, useLayoutEffect, useRef } from "react";

export type TooltipPosition = { rect: DOMRect; time: number } | null;
export const TooltipMotionContext = createContext<{ current: TooltipPosition }>({ current: null });

export function useTooltipMotion() {
  const previous = useContext(TooltipMotionContext);
  const content = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  const frame = useRef(0);
  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      if (placed.current && content.current) {
        previous.current = { rect: content.current.getBoundingClientRect(), time: Date.now() };
      }
    },
    [previous],
  );
  const onPlaced = () => {
    const node = content.current;
    if (!node || placed.current) return;
    placed.current = true;
    const rect = node.getBoundingClientRect();
    const last = previous.current;
    previous.current = { rect, time: Date.now() };
    if (node.dataset.state !== "instant-open" || !last || Date.now() - last.time > 300) return;
    // Solo viaja entre vecinos de una misma fila; entre barras distintas aparece sin viaje.
    if (Math.abs(last.rect.top - rect.top) > 8) return;
    node.style.setProperty("--ld-tooltip-x", `${last.rect.left - rect.left}px`);
    node.style.setProperty("--ld-tooltip-y", `${last.rect.top - rect.top}px`);
    node.dataset.travel = "start";
    // Fija la primera posición antes de activar la transición.
    node.getBoundingClientRect();
    frame.current = requestAnimationFrame(() => {
      node.dataset.travel = "end";
    });
  };
  return { content, onPlaced };
}

import type { PointerEvent } from "react";
import { useRef, useState } from "react";

export function tabDropIndex(x: number, centers: number[]): number {
  const index = centers.findIndex((center) => x < center);
  return index < 0 ? centers.length : index;
}

export function useTabDrag(move: (toolId: string, index: number) => void) {
  const gesture = useRef<{
    toolId: string;
    x: number;
    y: number;
    pointerId: number;
    target: number | null;
    centers: number[];
  } | null>(null);
  const suppressClick = useRef(false);
  const [drop, setDrop] = useState<{ toolId: string; index: number } | null>(null);
  return {
    drop,
    consumeClick() {
      const suppressed = suppressClick.current;
      suppressClick.current = false;
      return suppressed;
    },
    onPointerDown(event: PointerEvent<HTMLButtonElement>, toolId: string) {
      if (event.button !== 0 || !event.isPrimary) return;
      suppressClick.current = false;
      gesture.current = {
        toolId,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
        target: null,
        centers: [
          ...(event.currentTarget
            .closest('[role="tablist"]')
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []),
        ]
          .filter((button) => button !== event.currentTarget)
          .map((button) => {
            const bounds =
              button.parentElement?.getBoundingClientRect() ?? button.getBoundingClientRect();
            return bounds.left + bounds.width / 2;
          }),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (
        current.target === null &&
        Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4
      )
        return;
      current.target = tabDropIndex(event.clientX, current.centers);
      suppressClick.current = true;
      setDrop({ toolId: current.toolId, index: current.target });
    },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      gesture.current = null;
      setDrop(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (current.target !== null) move(current.toolId, current.target);
    },
    onPointerCancel() {
      gesture.current = null;
      setDrop(null);
    },
  };
}

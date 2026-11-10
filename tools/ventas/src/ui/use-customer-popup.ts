import { type RefObject, useLayoutEffect, useState } from "react";

export function useCustomerPopup(
  open: boolean,
  root: RefObject<HTMLElement | null>,
  popup: RefObject<HTMLElement | null>,
  close: () => void,
) {
  const [bounds, setBounds] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const input = root.current?.querySelector("input");
      if (!input) return;
      const rect = input.getBoundingClientRect(),
        next = {
          left: rect.left,
          top: rect.bottom + 4,
          width: rect.width,
          maxHeight: Math.max(100, Math.min(290, window.innerHeight - rect.bottom - 12)),
        };
      setBounds((old) =>
        old &&
        Object.keys(next).every(
          (key) => old[key as keyof typeof old] === next[key as keyof typeof next],
        )
          ? old
          : next,
      );
    };
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        close();
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, root, popup, close]);
  return bounds;
}

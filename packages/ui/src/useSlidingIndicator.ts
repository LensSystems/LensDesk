import { useLayoutEffect, useRef, useState } from "react";

export function useSlidingIndicator() {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef(false);
  const [motion, setMotion] = useState("off");
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number }>();

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let active: Element | null = null;
    let geometry = "";
    const measure = (selection = false) => {
      const next = root.querySelector(
        '[role="radio"][data-state="checked"], [role="tab"][data-state="active"]',
      );
      const changed = next !== active;
      active = next;
      const rect = next?.getBoundingClientRect();
      const parent = root.getBoundingClientRect();
      const signature = rect
        ? `${rect.left - parent.left},${rect.top - parent.top},${rect.width},${rect.height}`
        : "";
      if (!changed && signature === geometry) return;
      const measured = geometry !== "";
      geometry = signature;
      setMotion(selection && changed && measured && pointer.current ? "on" : "off");
      if (selection && changed) pointer.current = false;
      // Se ajusta a la rejilla de píxeles, como el fondo que pintaba la opción activa.
      const ratio = window.devicePixelRatio || 1;
      const snap = (value: number) => Math.round(value * ratio) / ratio;
      const originX = snap(parent.left + root.clientLeft - root.scrollLeft);
      const originY = snap(parent.top + root.clientTop - root.scrollTop);
      setBox(
        rect && rect.width > 0 && rect.height > 0
          ? {
              x: snap(rect.left) - originX,
              y: snap(rect.top) - originY,
              width: snap(rect.right) - snap(rect.left),
              height: snap(rect.bottom) - snap(rect.top),
            }
          : undefined,
      );
    };
    const resize =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => measure());
    const observe = () => {
      resize?.disconnect();
      resize?.observe(root);
      root.querySelectorAll('[role="radio"], [role="tab"]').forEach((item) => {
        resize?.observe(item);
      });
    };
    measure();
    observe();
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList" || record.type === "characterData"))
        observe();
      measure(true);
    });
    mutations.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => {
      resize?.disconnect();
      mutations.disconnect();
    };
  }, []);

  return {
    ref,
    "data-motion": motion,
    "data-indicator": box ? "ready" : undefined,
    onPointerDownCapture: () => {
      pointer.current = true;
    },
    onClickCapture: (event: React.MouseEvent) => {
      if (event.detail > 0) pointer.current = true;
    },
    onKeyDownCapture: () => {
      pointer.current = false;
      setMotion("off");
    },
    style: box
      ? { transform: `translateX(${box.x}px)`, top: box.y, width: box.width, height: box.height }
      : undefined,
  };
}

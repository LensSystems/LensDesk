import { type RefObject, useEffect, useState } from "react";

// Observa las dimensiones que gobiernan las consultas CSS, sin repetir sus umbrales.
export function useTooltipTextVisible(
  target: RefObject<HTMLElement | null>,
  selector?: string,
): boolean {
  const [visible, setVisible] = useState(Boolean(selector));
  useEffect(() => {
    if (!selector || !target.current) return;
    const root = target.current;
    const update = () => {
      const label = root.querySelector<HTMLElement>(selector);
      if (!label) return setVisible(false);
      const style = getComputedStyle(label);
      setVisible(
        style.display !== "none" &&
          style.visibility !== "hidden" &&
          !(style.position === "absolute" && (style.clip !== "auto" || style.clipPath !== "none")),
      );
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    for (let node: HTMLElement | null = root; node; node = node.parentElement)
      observer.observe(node);
    return () => observer.disconnect();
  }, [target, selector]);
  return Boolean(selector) && visible;
}

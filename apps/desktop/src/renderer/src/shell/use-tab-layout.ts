import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

export function tabInsets(width: number, left: number, right: number, required: number) {
  const symmetric = Math.max(left, right);
  return required <= width - 2 * symmetric
    ? { left: symmetric, right: symmetric }
    : { left, right };
}

export function useTabCenter() {
  const headerRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: Infinity, left: 0, right: 0 });
  useLayoutEffect(() => {
    const header = headerRef.current;
    const brand = brandRef.current;
    const actions = actionsRef.current;
    if (!header || !brand || !actions || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const rect = header.getBoundingClientRect();
      if (rect.width <= 0) return;
      const gap = Number.parseFloat(getComputedStyle(header).columnGap) || 0;
      setBounds({
        width: rect.width,
        left: brand.getBoundingClientRect().right - rect.left + gap,
        right: rect.right - actions.getBoundingClientRect().left + gap,
      });
    };
    const observer = new ResizeObserver(measure);
    for (const element of [header, brand, actions]) observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  return { headerRef, brandRef, actionsRef, ...bounds };
}

export function useCompactTabs(
  listRef: RefObject<HTMLDivElement | null>,
  names: string[],
  activeIndex: number,
  available: number,
) {
  const [space, setSpace] = useState({ available: Infinity, widths: [] as number[] });
  useEffect(() => {
    const container = listRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const labels = [...container.querySelectorAll<HTMLElement>("[data-tab-name]")];
      const widths = names.map((_, index) => labels[index]?.scrollWidth ?? 0);
      setSpace({ available: entry.contentRect.width, widths });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [listRef, names]);
  const padding = 8 + Math.max(0, names.length - 1) * 4;
  const widths = names.map((_, index) => {
    const width = space.widths[index] ?? 0;
    return width > 0 ? Math.min(192, width + 75) : 192;
  });
  // La compactación depende del espacio libre, nunca del ancho que deje el centrado.
  const compact =
    names.length > 5 ||
    (Number.isFinite(available) ? available : space.available) <
      widths.reduce((sum, width) => sum + width, padding);
  const required = widths.reduce(
    (sum, width, index) => sum + (compact && index !== activeIndex ? 30 : width),
    padding,
  );
  return { compact, required };
}

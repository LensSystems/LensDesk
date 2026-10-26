import { type MouseEvent, useLayoutEffect, useRef, useState } from "react";

type Box = { x: number; y: number; width: number; height: number };

export function useActiveTabIndicator(layout: string, dragging: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; until: number } | null>(null);
  const previous = useRef<{ id?: string; layout: string; geometry: string } | null>(null);
  const [box, setBox] = useState<Box>();
  const [motion, setMotion] = useState("off");
  useLayoutEffect(() => {
    // Cualquier tecla, otro toque o un cambio de tamaño anulan el clic pendiente.
    const key = () => {
      pending.current = null;
      setMotion("off");
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", key, true);
    window.addEventListener("resize", key);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", key, true);
      window.removeEventListener("resize", key);
    };
  }, []);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = (selection: boolean) => {
      const selected = root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      const id = selected?.dataset.tabId;
      const rect = selected?.parentElement?.getBoundingClientRect();
      const origin = root.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const snap = (value: number) => Math.round(value * ratio) / ratio;
      const next =
        rect && rect.width > 0 && rect.height > 0
          ? {
              x: snap(rect.left) - snap(origin.left + root.clientLeft - root.scrollLeft),
              y: snap(rect.top) - snap(origin.top + root.clientTop - root.scrollTop),
              width: snap(rect.right) - snap(rect.left),
              height: snap(rect.bottom) - snap(rect.top),
            }
          : undefined;
      const geometry = JSON.stringify(next) ?? "";
      const old = previous.current;
      // Durante un arrastre no hay deslizamiento; sin cambios de geometría no se toca el estado
      // (si no, cada render volvería a medir y a pedir otro render).
      if (dragging) {
        pending.current = null;
        setMotion("off");
      }
      if (old?.id === id && old?.layout === layout && old.geometry === geometry) return;
      const wanted = pending.current;
      const animate =
        selection &&
        !!next &&
        !!old?.geometry &&
        !!old.id &&
        old.id !== id &&
        old.layout === layout &&
        !dragging &&
        !!wanted &&
        wanted.id === id &&
        wanted.until > Date.now();
      setMotion(animate ? "on" : "off");
      if (old?.id !== id || old?.layout !== layout || dragging) pending.current = null;
      previous.current = { id, layout, geometry };
      setBox(next);
    };
    // Se mide en cada render: los cambios de ancho de la barra (ventana, modo compacto, nombres)
    // siempre pasan por un render de TabBar. El tamaño de la ventana se cubre aparte.
    measure(true);
    const resize = () => measure(false);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  });

  return {
    ref,
    ready: !!box,
    motion,
    style: box
      ? { transform: `translateX(${box.x}px)`, top: box.y, width: box.width, height: box.height }
      : undefined,
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      const tab = (event.target as Element).closest<HTMLElement>('[role="tab"]');
      // El clic sintético de teclado tiene detalle cero.
      pending.current =
        !dragging &&
        event.detail > 0 &&
        tab?.dataset.tabId &&
        tab.getAttribute("aria-selected") !== "true"
          ? { id: tab.dataset.tabId, until: Date.now() + 1000 }
          : null;
    },
  };
}

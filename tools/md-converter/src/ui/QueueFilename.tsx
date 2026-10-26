import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";

export function QueueFilename({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [distance, setDistance] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [moving, setMoving] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const copy = node.querySelector<HTMLElement>(".queue-filename-copy");
      if (!copy) return;
      const natural = Math.max(copy.scrollWidth, copy.getBoundingClientRect().width);
      setOverflow(natural > Math.max(node.clientWidth, node.getBoundingClientRect().width) + 0.5);
      setDistance(natural + 24);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const copy = node.querySelector(".queue-filename-copy");
    if (copy) observer.observe(copy);

    return () => observer.disconnect();
  }, []);
  // El puntero se escucha en toda la fila, no solo sobre el texto.
  useEffect(() => {
    const target = ref.current?.closest("button") ?? ref.current;
    if (!target) return;
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    target.addEventListener("mouseenter", enter);
    target.addEventListener("mouseleave", leave);
    return () => {
      target.removeEventListener("mouseenter", enter);
      target.removeEventListener("mouseleave", leave);
    };
  }, []);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    void name;
    setMoving(false);
    if (!hovered || !overflow || reduced) return;
    const timer = setTimeout(() => setMoving(true), 500);
    return () => clearTimeout(timer);
  }, [hovered, overflow, reduced, name]);
  return (
    <span
      ref={ref}
      className="queue-filename"
      data-moving={moving && !reduced}
      style={{ "--filename-distance": `-${distance}px` } as CSSProperties}
    >
      <span className="queue-filename-track">
        <span className="queue-filename-copy">{name}</span>
        {moving && !reduced && (
          <span className="queue-filename-repeat" aria-hidden="true">
            {name}
          </span>
        )}
      </span>
    </span>
  );
}

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export function NoticeText({
  children,
  paused = false,
}: {
  children: ReactNode;
  paused?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [overflow, setOverflow] = useState(false);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const content = node.querySelector<HTMLElement>("[data-notice-copy]");
      if (!content) return;
      setText(content.textContent ?? "");
      const natural = Math.max(content.scrollWidth, content.getBoundingClientRect().width);
      // Con medio píxel de margen: el redondeo de subpíxeles no cuenta como texto recortado.
      setOverflow(natural > Math.max(node.clientWidth, node.getBoundingClientRect().width) + 0.5);
      setDistance(natural + 24);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  });
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    void text;
    setReady(false);
    if (!overflow || reduced) return;
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, [overflow, reduced, text]);
  return (
    <span
      ref={ref}
      data-notice-text
      data-overflow={overflow}
      data-moving={ready && !reduced}
      data-paused={paused}
      style={{ "--notice-distance": `-${distance}px` } as CSSProperties}
      className="ld-notice-text block min-w-0 truncate"
    >
      <span className="ld-notice-track whitespace-nowrap">
        <span data-notice-copy>{children}</span>
        {ready && !reduced && (
          <span aria-hidden className="ld-notice-repeat">
            {children}
          </span>
        )}
      </span>
    </span>
  );
}

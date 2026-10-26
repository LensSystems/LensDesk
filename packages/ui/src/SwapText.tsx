import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn.ts";

export type SwapTextProps = {
  value: string;
  children?: ReactNode;
  className?: string;
  wrap?: (content: ReactNode) => ReactNode;
  // Lado al que se ancla el texto saliente; `end` cuando el texto está alineado a la derecha.
  align?: "start" | "end";
};

export function SwapText({
  value,
  children = value,
  className,
  wrap,
  align = "start",
}: SwapTextProps) {
  const [state, setState] = useState({ value, old: null as ReactNode });
  const root = useRef<HTMLSpanElement>(null);
  // Lo último que se pintó, aunque `children` cambie sin cambiar `value`.
  const shown = useRef(children);
  if (state.value !== value) {
    setState({ value, old: shown.current });
  }
  useLayoutEffect(() => {
    shown.current = children;
  });
  const moving = state.old !== null;
  useEffect(() => {
    if (!moving) return;
    const element = root.current?.querySelector("[data-swap-new]");
    for (const animation of element?.getAnimations?.() ?? []) {
      animation.currentTime = 0;
      animation.play();
    }
    const style = element && getComputedStyle(element);
    const duration = style ? Number.parseFloat(style.animationDuration) : 0;
    // El respaldo sigue la duración calculada, también cuando no hay movimiento.
    const milliseconds = duration * (style?.animationDuration.endsWith("ms") ? 1 : 1000);
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.value === state.value ? { ...current, old: null } : current,
        ),
      (Number.isFinite(milliseconds) ? milliseconds : 0) + 50,
    );
    return () => clearTimeout(timer);
  }, [moving, state.value]);
  const content = (
    <span ref={root} className={cn("ld-swap-text", align === "end" && "ld-swap-end", className)}>
      {moving && (
        <span
          key={state.value}
          className="ld-swap-old"
          aria-hidden="true"
          inert
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget)
              setState((current) => ({ ...current, old: null }));
          }}
        >
          {state.old}
        </span>
      )}
      <span key="current" data-swap-new className={moving ? "ld-swap-new" : undefined}>
        {children}
      </span>
    </span>
  );
  return wrap ? wrap(content) : content;
}

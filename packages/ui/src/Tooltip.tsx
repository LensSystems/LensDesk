import { Tooltip as Primitive } from "radix-ui";
import { type ComponentProps, type ReactElement, useEffect, useRef, useState } from "react";
import { TooltipContent } from "./TooltipContent.tsx";
import { TooltipTarget } from "./TooltipTarget.tsx";
import { TooltipMotionContext, type TooltipPosition } from "./tooltip-motion.ts";
import { useTooltipTextVisible } from "./use-tooltip-text-visible.ts";

export function TooltipProvider(props: ComponentProps<typeof Primitive.Provider>) {
  const position = useRef<TooltipPosition>(null);
  return (
    <TooltipMotionContext.Provider value={position}>
      <Primitive.Provider
        delayDuration={150}
        skipDelayDuration={300}
        disableHoverableContent
        {...props}
      />
    </TooltipMotionContext.Provider>
  );
}

export type TooltipProps = {
  label: string;
  disabled?: boolean;
  visibleTextSelector?: string;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  side?: ComponentProps<typeof Primitive.Content>["side"];
};

// Requiere un TooltipProvider en el árbol (se monta una vez en App.tsx).
export function Tooltip({
  label,
  children,
  className,
  side = "bottom",
  disabled = false,
  visibleTextSelector,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const leaving = useRef(false);
  const textVisible = useTooltipTextVisible(trigger, visibleTextSelector);
  const inactive = disabled || textVisible;
  // Tras salir de la ventana o perder el foco no se abre nada pendiente hasta que vuelva el
  // puntero o el foco de teclado.
  const suppressed = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    const leave = () => {
      suppressed.current = true;
      // Con foco de teclado en el disparador, la etiqueta sigue visible aunque salga el ratón.
      if (!trigger.current?.matches(":focus-visible")) setOpen(false);
    };
    const blur = () => {
      suppressed.current = true;
      setOpen(false);
    };
    const resume = () => {
      suppressed.current = false;
    };
    const mark = (flag: { current: boolean }) => {
      flag.current = true;
      setTimeout(() => {
        flag.current = false;
      }, 0);
    };
    // `pointerout` llega al disparador antes que al manejador de Radix en la raíz de React.
    // Los movimientos entre hijos del propio disparador no cuentan como salida.
    const out = (event: PointerEvent) => {
      if (event.relatedTarget instanceof Node && target?.contains(event.relatedTarget)) return;
      mark(leaving);
    };

    const target = trigger.current;
    root.addEventListener("mouseleave", leave);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("pointerenter", resume);
    // En captura, antes de que Radix intente abrir la etiqueta del control enfocado.
    document.addEventListener("focusin", resume, true);
    target?.addEventListener("pointerout", out);
    window.addEventListener("blur", blur);
    return () => {
      root.removeEventListener("mouseleave", leave);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("pointerenter", resume);
      document.removeEventListener("focusin", resume, true);
      target?.removeEventListener("pointerout", out);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const changeOpen = (next: boolean) => {
    if (next && (suppressed.current || inactive)) return;
    // Con foco de teclado, que el ratón salga del disparador no la cierra (los demás cierres sí).
    if (!next && leaving.current && trigger.current?.matches(":focus-visible")) return;
    setOpen(next);
  };
  if (disabled) return children;
  return (
    <Primitive.Root open={!inactive && open} onOpenChange={changeOpen}>
      <Primitive.Trigger asChild ref={trigger}>
        <TooltipTarget
          {...children.props}
          element={children}
          redundant={children.props["aria-label"] === label}
        />
      </Primitive.Trigger>
      <Primitive.Portal>
        <TooltipContent className={className} side={side}>
          {label}
        </TooltipContent>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

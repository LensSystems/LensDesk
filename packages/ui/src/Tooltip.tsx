import { Tooltip as Primitive } from "radix-ui";
import { type ComponentProps, type ReactElement, useEffect, useRef, useState } from "react";
import { cn } from "./cn.ts";
import { TooltipTarget } from "./TooltipTarget.tsx";

export function TooltipProvider(props: ComponentProps<typeof Primitive.Provider>) {
  return (
    <Primitive.Provider
      delayDuration={150}
      skipDelayDuration={300}
      disableHoverableContent
      {...props}
    />
  );
}

export type TooltipProps = {
  label: string;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  side?: ComponentProps<typeof Primitive.Content>["side"];
};

// Requiere un TooltipProvider en el árbol (se monta una vez en App.tsx).
export function Tooltip({ label, children, className, side = "bottom" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const leaving = useRef(false);
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
    if (next && suppressed.current) return;
    // Con foco de teclado, que el ratón salga del disparador no la cierra (los demás cierres sí).
    if (!next && leaving.current && trigger.current?.matches(":focus-visible")) return;
    setOpen(next);
  };
  return (
    <Primitive.Root open={open} onOpenChange={changeOpen}>
      <Primitive.Trigger asChild ref={trigger}>
        <TooltipTarget
          {...children.props}
          element={children}
          redundant={children.props["aria-label"] === label}
        />
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className={cn(
            "ld-tooltip ld-pop z-50 rounded-ld-md border border-border bg-surface-raised px-2 py-1 text-xs text-text shadow-ld",
            className,
          )}
          side={side}
          sideOffset={4}
        >
          {label}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

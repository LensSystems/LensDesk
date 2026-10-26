import { type InputHTMLAttributes, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn.ts";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "defaultChecked" | "onChange"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const id = useId();
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const isChecked = checked ?? internalChecked;
  const previousChecked = useRef(isChecked);
  const [motion, setMotion] = useState(false);
  useLayoutEffect(() => {
    if (previousChecked.current === isChecked) return;
    previousChecked.current = isChecked;
    // El dibujo solo acompaña a un cambio hecho con el movimiento permitido y se apaga al terminar.
    setMotion(
      isChecked && window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches === true,
    );
  }, [isChecked]);
  return (
    <input
      {...props}
      checked={isChecked}
      data-motion={motion ? "on" : undefined}
      onAnimationEnd={(event) => {
        props.onAnimationEnd?.(event);
        setMotion(false);
      }}
      className={cn(
        "ld-checkbox size-6 shrink-0 cursor-pointer appearance-none rounded-ld-sm disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      id={props.id ?? id}
      onChange={(event) => {
        const nextChecked = event.currentTarget.checked;
        if (checked === undefined) setInternalChecked(nextChecked);
        onCheckedChange?.(nextChecked);
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== " ") return;
        event.preventDefault();
        if (event.repeat || props.disabled) return;
        const nextChecked = !isChecked;
        if (checked === undefined) setInternalChecked(nextChecked);
        onCheckedChange?.(nextChecked);
      }}
      type="checkbox"
    />
  );
}

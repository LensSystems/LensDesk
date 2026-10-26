import { type InputHTMLAttributes, useId, useState } from "react";
import { cn } from "./cn.ts";

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "defaultChecked" | "onChange"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const id = useId();
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const isChecked = checked ?? internalChecked;
  return (
    <input
      {...props}
      aria-checked={isChecked}
      checked={isChecked}
      className={cn(
        "ld-switch relative size-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full border border-border-control bg-border checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      id={props.id ?? id}
      onChange={(event) => {
        if (checked === undefined) setInternalChecked(event.currentTarget.checked);
        onCheckedChange?.(event.currentTarget.checked);
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
      role="switch"
      type="checkbox"
    />
  );
}

import { type InputHTMLAttributes, useId, useState } from "react";
import { cn } from "../cn.ts";

type CheckboxProps = Omit<
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
  return (
    <input
      {...props}
      checked={isChecked}
      className={cn("size-6 accent-accent", className)}
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

import { RadioGroup as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { useSlidingIndicator } from "./useSlidingIndicator.ts";

export type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  "aria-label": string;
  className?: string;
  fullWidth?: boolean;
  itemClassName?: string;
  indicatorClassName?: string;
};

export function SegmentedControl({
  value,
  onValueChange,
  options,
  className,
  fullWidth = false,
  itemClassName,
  indicatorClassName,
  "aria-label": label,
}: SegmentedControlProps) {
  const { style, ...indicator } = useSlidingIndicator();
  return (
    <Primitive.Root
      {...indicator}
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      loop
      className={cn(
        "ld-selector inline-flex rounded-full bg-bg p-0.5",
        fullWidth && "w-full border border-border",
        className,
      )}
    >
      {style && (
        <span
          aria-hidden="true"
          className={cn(
            "ld-indicator rounded-full bg-surface-raised shadow-sm",
            indicatorClassName,
          )}
          style={style}
        />
      )}
      {options.map((option) => (
        <Primitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "ld-option h-7 rounded-full px-3.5 text-[13px] text-muted hover:text-text data-[state=checked]:bg-surface-raised data-[state=checked]:font-semibold data-[state=checked]:text-text data-[state=checked]:shadow-sm disabled:opacity-45",
            fullWidth && "min-w-0 flex-1 basis-0 px-2 text-center",
            itemClassName,
          )}
        >
          {option.label}
        </Primitive.Item>
      ))}
    </Primitive.Root>
  );
}

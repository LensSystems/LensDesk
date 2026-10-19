import { RadioGroup as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  "aria-label": string;
  className?: string;
};

export function SegmentedControl({
  value,
  onValueChange,
  options,
  className,
  "aria-label": label,
}: SegmentedControlProps) {
  return (
    <Primitive.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      loop
      className={cn(
        "inline-flex gap-1 rounded border border-border-control bg-surface p-1",
        className,
      )}
    >
      {options.map((option) => (
        <Primitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="h-7 rounded px-2 text-text transition-colors duration-150 ease-out hover:bg-surface-raised data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg disabled:opacity-60 motion-reduce:transition-none"
        >
          {option.label}
        </Primitive.Item>
      ))}
    </Primitive.Root>
  );
}

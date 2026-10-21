import { Select as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export const Select = Primitive.Root;
export const SelectGroup = Primitive.Group;
export const SelectValue = Primitive.Value;
export const SelectLabel = Primitive.Label;
export const SelectSeparator = Primitive.Separator;

export function SelectTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      {...props}
      className={cn(
        "inline-flex h-9 min-w-28 items-center justify-between gap-2 rounded-ld-md border border-border-control bg-surface-raised px-3 text-text transition-colors duration-150 ease-out disabled:opacity-45 motion-reduce:transition-none",
        className,
      )}
    >
      {children}
      <Primitive.Icon aria-hidden>⌄</Primitive.Icon>
    </Primitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        className={cn(
          "ld-pop z-50 overflow-hidden rounded-ld-lg border border-border bg-surface-raised text-text shadow-ld",
          className,
        )}
      >
        <Primitive.Viewport className="p-1">{children}</Primitive.Viewport>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      {...props}
      className={cn(
        "relative flex h-7 select-none items-center rounded-ld-sm pr-2 pl-6 focus:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="absolute left-2">✓</Primitive.ItemIndicator>
    </Primitive.Item>
  );
}

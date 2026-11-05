import { ChevronDown } from "lucide-react";
import { Select as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.ts";

export const Select = Primitive.Root;
export const SelectGroup = Primitive.Group;
export const SelectValue = Primitive.Value;
export const SelectLabel = Primitive.Label;
export const SelectSeparator = Primitive.Separator;

export function SelectTrigger({
  className,
  children,
  icon,
  ...props
}: ComponentProps<typeof Primitive.Trigger> & { icon?: ReactNode }) {
  return (
    <Primitive.Trigger
      {...props}
      className={cn(
        "ld-select-trigger inline-flex h-9 min-w-28 items-center justify-between gap-2 rounded-ld-md border border-border-control bg-surface-raised px-3 text-text transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger motion-reduce:transition-none",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {icon !== null && (
        <Primitive.Icon
          aria-hidden="true"
          className="pointer-events-none inline-flex shrink-0 items-center justify-center"
        >
          {icon === undefined ? (
            <ChevronDown
              aria-hidden="true"
              focusable="false"
              size={16}
              strokeWidth={2}
              className="ld-select-chevron text-muted"
            />
          ) : (
            <span className="contents">{icon}</span>
          )}
        </Primitive.Icon>
      )}
    </Primitive.Trigger>
  );
}

export function SelectContent({
  position = "popper",
  sideOffset = 4,
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "ld-pop z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)] overflow-hidden rounded-ld-lg border border-border bg-surface-raised text-text shadow-ld",
          className,
        )}
      >
        <Primitive.Viewport className="max-h-[var(--radix-select-content-available-height)] overflow-y-auto p-1">
          {children}
        </Primitive.Viewport>
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
        "relative flex min-h-7 select-none items-center rounded-ld-sm py-1 pr-2 pl-6 focus:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
    >
      <Primitive.ItemText className="min-w-0 break-words">{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className="absolute left-2">✓</Primitive.ItemIndicator>
    </Primitive.Item>
  );
}

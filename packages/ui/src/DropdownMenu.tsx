import { DropdownMenu as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      {...props}
      className={cn(
        "flex h-7 cursor-default items-center rounded px-2 focus:bg-surface focus:text-text",
        className,
      )}
    />
  );
}
export const DropdownMenuCheckboxItem = Primitive.CheckboxItem;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;
export const DropdownMenuRadioItem = Primitive.RadioItem;
export const DropdownMenuLabel = Primitive.Label;
export const DropdownMenuSeparator = Primitive.Separator;

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        className={cn(
          "ld-pop z-50 min-w-32 rounded-md border border-border bg-surface-raised p-1 text-text shadow-[0_8px_24px_rgb(0_0_0/0.24)] outline-none",
          className,
        )}
      />
    </Primitive.Portal>
  );
}

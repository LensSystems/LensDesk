import { DropdownMenu as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export type DropdownMenuItemProps = ComponentProps<typeof Primitive.Item> & {
  destructive?: boolean;
};

export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: DropdownMenuItemProps) {
  return (
    <Primitive.Item
      {...props}
      className={cn(
        "flex cursor-default items-center rounded-ld-sm px-2.5 py-2 transition-colors duration-150 ease-out data-[highlighted]:bg-surface data-[disabled]:opacity-45 motion-reduce:transition-none",
        destructive && "text-danger",
        className,
      )}
    />
  );
}
export const DropdownMenuCheckboxItem = Primitive.CheckboxItem;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;
export const DropdownMenuRadioItem = Primitive.RadioItem;
export const DropdownMenuLabel = Primitive.Label;
export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator {...props} className={cn("my-1 h-px bg-border", className)} />;
}

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        className={cn(
          "ld-pop z-50 min-w-32 rounded-ld-lg border border-border bg-surface-raised p-1.5 text-[13px] text-text shadow-ld",
          className,
        )}
      />
    </Primitive.Portal>
  );
}

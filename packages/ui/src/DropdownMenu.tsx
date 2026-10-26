import { DropdownMenu as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";
import { dropdownMenuContentClass, menuItemClass } from "./menu-styles.ts";

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
      className={cn(menuItemClass, destructive && "text-danger", className)}
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
  return <Primitive.Separator {...props} className={cn("my-1 mx-1.5 h-px bg-border", className)} />;
}

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content {...props} className={cn(dropdownMenuContentClass, className)} />
    </Primitive.Portal>
  );
}

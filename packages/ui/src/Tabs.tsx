import { Tabs as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      {...props}
      className={cn("inline-flex items-center rounded-full bg-bg p-0.5", className)}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      {...props}
      className={cn(
        "h-7 rounded-full px-3.5 text-[13px] text-muted transition-colors duration-150 ease-out hover:text-text data-[state=active]:bg-surface-raised data-[state=active]:font-semibold data-[state=active]:text-text data-[state=active]:shadow-sm disabled:opacity-45 motion-reduce:transition-none",
        className,
      )}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content {...props} className={cn("pt-3", className)} />;
}

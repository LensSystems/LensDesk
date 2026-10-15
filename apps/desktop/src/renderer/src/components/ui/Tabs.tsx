import { Tabs as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.ts";

export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      {...props}
      className={cn("inline-flex items-center gap-1 border-b border-border", className)}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      {...props}
      className={cn(
        "h-8 border-b-2 border-transparent px-3 text-muted transition-colors duration-150 ease-out hover:text-text data-[state=active]:border-accent data-[state=active]:text-text motion-reduce:transition-none",
        className,
      )}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content {...props} className={cn("pt-3", className)} />;
}

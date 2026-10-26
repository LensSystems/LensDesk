import { Tabs as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "./cn.ts";
import { useSlidingIndicator } from "./useSlidingIndicator.ts";

export const Tabs = Primitive.Root;

export function TabsList({
  className,
  indicatorClassName,
  children,
  ...props
}: ComponentProps<typeof Primitive.List> & { indicatorClassName?: string }) {
  const { style, ...indicator } = useSlidingIndicator();
  return (
    <Primitive.List
      {...indicator}
      {...props}
      className={cn("ld-selector inline-flex items-center rounded-full bg-bg p-0.5", className)}
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
      {children}
    </Primitive.List>
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      {...props}
      className={cn(
        "ld-option h-7 rounded-full px-3.5 text-[13px] text-muted hover:text-text data-[state=active]:bg-surface-raised data-[state=active]:font-semibold data-[state=active]:text-text data-[state=active]:shadow-sm disabled:opacity-45",
        className,
      )}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content {...props} className={cn("pt-3", className)} />;
}

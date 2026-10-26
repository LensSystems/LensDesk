import { ContextMenu as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";
import { contextMenuContentClass, menuItemClass, menuShortcutClass } from "./menu-styles.ts";

export type ContextMenuEntry =
  | { separator: true }
  | {
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      note?: string;
      disabled?: boolean;
      onSelect?: () => void;
      items?: ContextMenuEntry[];
      contentClassName?: string;
    };

export function ContextMenuItems({ items }: { items: ContextMenuEntry[] }) {
  return items.map((item, index) => {
    if ("separator" in item)
      return (
        <Primitive.Separator
          key={items
            .slice(0, index)
            .flatMap((entry) => ("label" in entry ? [entry.label] : []))
            .join("/")}
          className="my-1 mx-1.5 h-px bg-border"
        />
      );
    const content = (
      <>
        {item.icon && (
          <span
            aria-hidden="true"
            className="flex w-5 shrink-0 items-center justify-center text-xs font-bold text-muted [&_svg]:size-3.5 [&_svg]:stroke-2"
          >
            {item.icon}
          </span>
        )}
        <span>{item.label}</span>
        {item.shortcut && <kbd className={cn(menuShortcutClass, "font-sans")}>{item.shortcut}</kbd>}
        {!item.shortcut && item.note && (
          <span className={cn(menuShortcutClass, "text-[11px]")}>{item.note}</span>
        )}
        {item.items && (
          <span aria-hidden="true" className={menuShortcutClass}>
            ›
          </span>
        )}
      </>
    );
    return item.items ? (
      <Primitive.Sub key={item.label}>
        <Primitive.SubTrigger className={menuItemClass} disabled={item.disabled}>
          {content}
        </Primitive.SubTrigger>
        <Primitive.Portal>
          <Primitive.SubContent
            aria-label={item.label}
            className={cn(contextMenuContentClass, item.contentClassName)}
            sideOffset={-8}
            alignOffset={-7}
          >
            <ContextMenuItems items={item.items} />
          </Primitive.SubContent>
        </Primitive.Portal>
      </Primitive.Sub>
    ) : (
      <Primitive.Item
        aria-label={item.label}
        aria-description={item.note}
        key={item.label}
        className={menuItemClass}
        disabled={item.disabled}
        onSelect={item.onSelect}
      >
        {content}
      </Primitive.Item>
    );
  });
}

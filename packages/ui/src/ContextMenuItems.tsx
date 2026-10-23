import { ChevronRight } from "lucide-react";
import { ContextMenu as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { menuContentClass, menuItemClass } from "./menu-styles.ts";

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
          className="my-1 h-px bg-border"
        />
      );
    const content = (
      <>
        {item.icon && (
          <span
            aria-hidden="true"
            className="mr-3 flex size-4 items-center justify-center text-muted"
          >
            {item.icon}
          </span>
        )}
        <span>{item.label}</span>
        {(item.shortcut || item.note) && (
          <span className="ml-auto pl-6 text-xs text-muted">{item.shortcut || item.note}</span>
        )}
        {item.items && <ChevronRight aria-hidden="true" className="ml-auto size-3" />}
      </>
    );
    return item.items ? (
      <Primitive.Sub key={item.label}>
        <Primitive.SubTrigger className={menuItemClass} disabled={item.disabled}>
          {content}
        </Primitive.SubTrigger>
        <Primitive.Portal>
          <Primitive.SubContent aria-label={item.label} className={menuContentClass}>
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

import { ContextMenu as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { menuContentClass, menuItemClass } from "./menu-styles.ts";

export function ContextMenu({
  children,
  label,
  items,
  onClose,
  keyboardAnchor,
}: {
  children: ReactNode;
  label: string;
  items: { label: string; disabled?: boolean; onSelect: () => void }[];
  onClose?: () => void;
  /** Punto donde abrir el menú con Mayús+F10 (por defecto, la esquina del área). */
  keyboardAnchor?: () => { x: number; y: number } | null;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger
        asChild
        onKeyDown={(event) => {
          if (event.key !== "F10" || !event.shiftKey) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const point = keyboardAnchor?.() ?? { x: rect.left, y: rect.top };
          event.currentTarget.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: point.x,
              clientY: point.y,
            }),
          );
        }}
      >
        {children}
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className={menuContentClass}
          aria-label={label}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClose?.();
          }}
        >
          <Primitive.Label className="px-2.5 py-1 text-muted">{label}</Primitive.Label>
          {items.map((item) => (
            <Primitive.Item
              key={item.label}
              className={menuItemClass}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.label}
            </Primitive.Item>
          ))}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

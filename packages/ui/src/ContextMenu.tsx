import { ContextMenu as Primitive } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { type ContextMenuEntry, ContextMenuItems } from "./ContextMenuItems.tsx";
import { cn } from "./cn.ts";
import { contextMenuContentClass, menuItemClass } from "./menu-styles.ts";

export function ContextMenu({
  children,
  contentClassName,
  label,
  items,
  onClose,
  keyboardAnchor,
  onNativeContextMenu,
  leadingGroup,
  showLabel = true,
}: {
  onNativeContextMenu?: (
    point: { x: number; y: number },
    open: (point: { x: number; y: number }) => void,
  ) => void;
  leadingGroup?: {
    label: string;
    items: { label: string; disabled?: boolean; onSelect: () => void }[];
  };
  showLabel?: boolean;
  contentClassName?: string;
  children: ReactNode;
  label: string;
  items: ContextMenuEntry[] | (() => ContextMenuEntry[]);
  onClose?: () => void;
  /** Punto donde abrir el menú con Mayús+F10 (por defecto, la esquina del área). */
  keyboardAnchor?: () => { x: number; y: number } | null;
}) {
  const [, refresh] = useState(0);
  const ownEvents = useRef(new WeakSet<Event>());
  const open = (target: EventTarget, point: { x: number; y: number }) => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
    });
    ownEvents.current.add(event);
    target.dispatchEvent(event);
  };
  return (
    <Primitive.Root onOpenChange={() => refresh((value) => value + 1)}>
      <Primitive.Trigger
        asChild
        onContextMenuCapture={(event) => {
          if (!onNativeContextMenu || ownEvents.current.has(event.nativeEvent)) return;
          event.stopPropagation();
          const target = event.currentTarget;
          onNativeContextMenu({ x: event.clientX, y: event.clientY }, (point) =>
            open(target, point),
          );
        }}
        onKeyDown={(event) => {
          if (event.key !== "ContextMenu" && (event.key !== "F10" || !event.shiftKey)) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const point = keyboardAnchor?.() ?? { x: rect.left, y: rect.top };
          open(event.currentTarget, point);
        }}
      >
        {children}
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className={cn(contextMenuContentClass, contentClassName)}
          aria-label={label}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClose?.();
          }}
        >
          {leadingGroup && (
            <>
              <Primitive.Label className="px-2.5 py-1 text-muted">
                {leadingGroup.label}
              </Primitive.Label>
              {leadingGroup.items.map((item) => (
                <Primitive.Item
                  key={item.label}
                  className={menuItemClass}
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                >
                  {item.label}
                </Primitive.Item>
              ))}
              <Primitive.Separator className="my-1 mx-1.5 h-px bg-border" />
            </>
          )}
          {showLabel && (
            <Primitive.Label className="px-2.5 py-1 text-muted">{label}</Primitive.Label>
          )}
          <ContextMenuItems items={typeof items === "function" ? items() : items} />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

export type { ContextMenuEntry } from "./ContextMenuItems.tsx";

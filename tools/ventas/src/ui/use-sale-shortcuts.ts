import { type RefObject, useEffect } from "react";

export function useSaleShortcuts(root: RefObject<HTMLElement | null>, disabled: boolean) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        disabled ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        return;
      const selector =
        event.key === "F2"
          ? "[data-sale-product-search]"
          : event.key === "F4"
            ? "[data-sale-client-search]"
            : null;
      const input = selector ? root.current?.querySelector<HTMLInputElement>(selector) : null;
      if (!input || input.disabled) return;
      event.preventDefault();
      input.focus();
      if (event.key === "F4") input.click();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [root, disabled]);
}

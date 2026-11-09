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
      if (event.key === "F9" || event.key === "F10") {
        const button = root.current?.querySelector<HTMLButtonElement>(
          event.key === "F9" ? "[data-sale-credit]" : "[data-sale-checkout]",
        );
        if (!button || button.disabled) return;
        event.preventDefault();
        button.click();
        return;
      }
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

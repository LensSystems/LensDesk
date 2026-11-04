export const menuItemClass =
  "flex h-8 items-center gap-2.5 text-[13px] leading-[18.85px] font-normal text-text rounded-ld-sm px-2.5 transition-colors duration-150 ease-out data-[highlighted]:bg-surface data-[disabled]:text-border-control motion-reduce:transition-none";
const menuContentClass =
  "ld-pop z-50 min-w-32 rounded-ld-lg border border-border bg-surface-raised p-1.5 text-[13px] text-text shadow-ld";

export const menuShortcutClass = "ml-auto text-xs leading-[17.4px] font-normal text-muted";

export const dropdownMenuContentClass = `${menuContentClass} origin-[var(--radix-dropdown-menu-content-transform-origin)]`;
export const contextMenuContentClass = `${menuContentClass} max-h-[var(--radix-context-menu-content-available-height)] overflow-auto scroll-p-1 overscroll-contain origin-[var(--radix-context-menu-content-transform-origin)]`;

import { type ComponentProps, useCallback } from "react";
import { HEADER_HEIGHT } from "../../../shared/layout.ts";

export function PageFrame({
  children,
  settings: _settings = false,
  ...props
}: ComponentProps<"main"> & { settings?: boolean }) {
  const focusHeading = useCallback((element: HTMLElement | null) => {
    const heading = element?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.style.outline = "none";
      heading.focus();
    }
  }, []);
  return (
    <main
      {...props}
      ref={focusHeading}
      style={{ height: `calc(100dvh - ${HEADER_HEIGHT}px - 12px)` }}
      className={`@container mx-3 mb-3 flex min-h-0 flex-col gap-4 min-[900px]:gap-7 overflow-y-auto rounded-ld-lg border border-border bg-surface-raised p-6 min-[900px]:px-12 min-[900px]:py-10 transition-[width,padding] duration-150 ease-out motion-reduce:transition-none`}
    >
      {children}
    </main>
  );
}

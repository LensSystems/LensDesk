import type { useActiveTabIndicator } from "./use-active-tab-indicator.ts";

// Fondo de la pestaña activa: decorativo, se mueve sobre la pestaña seleccionada.
export function ActiveTabIndicator({
  indicator,
}: {
  indicator: ReturnType<typeof useActiveTabIndicator>;
}) {
  if (!indicator.ready) return null;
  return (
    <span
      aria-hidden="true"
      className="ld-active-tab-indicator"
      data-motion={indicator.motion}
      style={indicator.style}
    />
  );
}

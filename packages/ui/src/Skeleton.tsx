import { cloneElement, type ReactElement, useEffect, useState } from "react";
import { cn } from "./cn.ts";
import { useUiLabels } from "./ui-labels.ts";

export type SkeletonProps = {
  loading: boolean;
  label?: string;
  variant?: "notes" | "document";
  children: ReactElement<{ className?: string }>;
};

export function Skeleton({ loading, label, variant = "document", children }: SkeletonProps) {
  const labels = useUiLabels();
  const [state, setState] = useState({ loading, visible: false });
  if (state.loading !== loading) {
    setState({ loading, visible: loading ? false : state.visible });
  }
  const visible = state.visible;
  useEffect(() => {
    const timer = setTimeout(() => setState({ loading, visible: loading }), loading ? 200 : 160);
    return () => clearTimeout(timer);
  }, [loading]);

  if (!loading) {
    return visible
      ? cloneElement(children, { className: cn(children.props.className, "ld-carga-entrada") })
      : children;
  }
  if (!visible) return null;
  return (
    <div role="status" className={cn("ld-esqueleto", `ld-esqueleto-${variant}`)}>
      <span className="sr-only">{label ?? labels.loading}</span>
      <div aria-hidden="true" className="ld-esqueleto-bloques">
        {variant === "notes" && (
          <div className="ld-esqueleto-lista">
            {["uno", "dos", "tres", "cuatro", "cinco"].map((line) => (
              <div key={line} className="ld-esqueleto-tarjeta rounded-ld-md">
                <span className="rounded-ld-sm" />
                <span className="rounded-ld-sm" />
              </div>
            ))}
          </div>
        )}
        <div className="ld-esqueleto-documento">
          {["titulo", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete"].map((line) => (
            <span key={line} className="rounded-ld-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

import { cn } from "./cn.ts";
import { useUiLabels } from "./ui-labels.ts";

export type ProgressProps = React.ComponentProps<"span"> & { label?: string };

export function Progress({ className, label, ...props }: ProgressProps) {
  const labels = useUiLabels();
  return (
    <span
      aria-label={label ?? labels.loading}
      className={cn(
        "inline-block size-3 animate-spin motion-reduce:animate-none rounded-full border-2 border-current border-r-transparent",
        className,
      )}
      role="progressbar"
      {...props}
    />
  );
}

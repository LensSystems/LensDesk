import { useTranslation } from "react-i18next";
import { cn } from "../cn.ts";

type ProgressProps = React.ComponentProps<"span"> & { label?: string };

export function Progress({ className, label, ...props }: ProgressProps) {
  const { t } = useTranslation();
  return (
    <span
      aria-label={label ?? t("ui.loading")}
      className={cn(
        "inline-block size-3 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
      role="progressbar"
      {...props}
    />
  );
}

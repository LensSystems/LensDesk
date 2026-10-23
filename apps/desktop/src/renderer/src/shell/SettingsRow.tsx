import type { ComponentProps, ReactNode } from "react";

type SettingsRowProps = {
  label?: string;
  description?: string;
  descriptionId?: string;
  children: ReactNode;
  status?: ReactNode;
} & ComponentProps<"div">;

export function SettingsRow({
  label,
  description,
  descriptionId,
  children,
  status,
  className = "",
  ...props
}: SettingsRowProps) {
  return (
    <div
      {...props}
      className={`before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-border first:before:hidden relative flex items-center gap-4 px-4 py-3 ${className}`}
    >
      <div className="min-w-0 flex-1">
        {label && <p className="font-semibold">{label}</p>}
        {description && (
          <p id={descriptionId} className="text-[13px] text-muted">
            {description}
          </p>
        )}
        {status}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

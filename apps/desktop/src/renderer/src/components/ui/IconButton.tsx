import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../cn.ts";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  children: ReactNode;
};

export function IconButton({ className, label, children, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded text-text hover:bg-surface-raised",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

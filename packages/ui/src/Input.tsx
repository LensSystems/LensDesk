import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "./cn.ts";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  error?: ReactNode;
  leadingIcon?: ReactNode;
  id?: string;
};

export function Input({
  className,
  error,
  id: suppliedId,
  label,
  leadingIcon,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1">
      <label className="text-text" htmlFor={id}>
        {label}
      </label>
      <div className="relative min-w-0">
        {leadingIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
          >
            {leadingIcon}
          </span>
        )}
        <input
          {...props}
          aria-describedby={
            error
              ? [props["aria-describedby"], errorId].filter(Boolean).join(" ")
              : props["aria-describedby"]
          }
          aria-invalid={error ? true : props["aria-invalid"]}
          className={cn(
            "h-9 rounded-ld-md border border-border-control bg-bg px-3 text-text placeholder:text-muted transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
            "w-full",
            leadingIcon && "pl-9",
            error && "border-danger",
            className,
          )}
          id={id}
        />
      </div>
      {error && (
        <span className="text-danger" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

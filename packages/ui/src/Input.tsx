import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "./cn.ts";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: ReactNode;
  error?: ReactNode;
  id?: string;
};

export function Input({ className, error, id: suppliedId, label, ...props }: InputProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1">
      <label className="text-text" htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        aria-describedby={
          error
            ? [props["aria-describedby"], errorId].filter(Boolean).join(" ")
            : props["aria-describedby"]
        }
        aria-invalid={error ? true : props["aria-invalid"]}
        className={cn(
          "h-7 rounded border border-border-control bg-surface px-2 text-text placeholder:text-muted",
          className,
        )}
        id={id}
      />
      {error && (
        <span className="text-danger" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

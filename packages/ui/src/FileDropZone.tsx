import { useRef, useState } from "react";
import { Button } from "./Button.tsx";
import { cn } from "./cn.ts";

export type FileDropZoneProps = {
  size?: "md" | "compact";
  buttonVariant?: "default" | "primary";
  onFiles?: (files: File[]) => void;
  onBrowse?: () => void;
  "aria-label"?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label: string;
  buttonLabel: string;
  description?: string;
  className?: string;
};
export function FileDropZone({
  size = "md",
  buttonVariant = "default",
  onFiles,
  onBrowse,
  "aria-label": accessibleLabel,
  accept,
  multiple = false,
  disabled = false,
  label,
  buttonLabel,
  description,
  className,
}: FileDropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const deliver = (files: File[]) => {
    if (disabled || !onFiles) return;
    const patterns = accept
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const accepted = files.filter(
      (file) =>
        !patterns?.length ||
        patterns.some((pattern) =>
          pattern.startsWith(".")
            ? file.name.toLowerCase().endsWith(pattern)
            : pattern.endsWith("/*")
              ? file.type.toLowerCase().startsWith(pattern.slice(0, -1))
              : file.type.toLowerCase() === pattern,
        ),
    );
    if (accepted.length) onFiles(multiple ? accepted : accepted.slice(0, 1));
  };
  return (
    <section
      aria-label={accessibleLabel ?? label}
      aria-disabled={disabled}
      data-dragging={!disabled && dragging}
      className={cn(
        "grid justify-items-start gap-2 rounded-ld-lg border-2 border-dashed border-border-control bg-surface p-3 text-text data-[dragging=true]:border-accent data-[dragging=true]:bg-accent-soft",
        size === "compact" && "flex items-center gap-3 px-3.5",
        disabled && "opacity-60",
        className,
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (onFiles) deliver(Array.from(event.dataTransfer.files));
      }}
    >
      <p className={cn("text-[13px] text-muted", size === "compact" && "min-w-0 flex-1")}>
        {label}
      </p>
      {description && <p className="text-xs text-muted">{description}</p>}
      {!onBrowse && (
        <input
          ref={input}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            deliver(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      )}
      <Button
        type="button"
        variant={buttonVariant}
        className="shrink-0"
        disabled={disabled}
        onClick={() => (onBrowse ? onBrowse() : input.current?.click())}
      >
        {buttonLabel}
      </Button>
    </section>
  );
}

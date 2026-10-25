import { Eye, EyeOff } from "@lensdesk/ui";
import { type InputHTMLAttributes, type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

export function SecretField({
  invalid = false,
  label,
  secret = false,
  compact = false,
  mono = false,
  hideLabel = false,
  actions,
  maxLength,
  onChange,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  label: string;
  secret?: boolean;
  compact?: boolean;
  mono?: boolean;
  hideLabel?: boolean;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className={`secret-field grid gap-1 ${compact ? "credential-input" : ""}`}>
      <label
        htmlFor={id}
        className={`${hideLabel ? "sr-only" : ""} text-xs font-semibold ${compact ? "text-muted" : "text-text"}`}
      >
        {label}
      </label>
      <div
        className={`secret-field-control flex items-center gap-1 rounded-ld-md border ${invalid ? "border-danger" : "border-border-control"} bg-bg`}
      >
        <input
          {...props}
          aria-invalid={invalid || undefined}
          maxLength={maxLength}
          onChange={(event) => {
            if (maxLength === undefined || [...event.target.value].length <= maxLength)
              onChange?.(event);
          }}
          id={id}
          type={secret && !shown ? "password" : "text"}
          className={`min-w-0 flex-1 bg-transparent text-[13px] text-text ${mono ? "font-mono" : ""} ${className}`}
        />
        {secret && (
          <button
            type="button"
            className="field-action"
            aria-label={t(shown ? "credential.hideField" : "credential.showField", { name: label })}
            onClick={() => setShown(!shown)}
          >
            {shown ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

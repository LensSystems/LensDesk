import { Eye, EyeOff } from "@lensdesk/ui";
import {
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

export function SecretField({
  failure = 0,
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
  failure?: number;
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
  const control = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = control.current;
    if (!element || !failure) return;
    // Reinicia incluso si el fallo anterior sigue en movimiento.
    element.removeAttribute("data-failure");
    void element.offsetWidth;
    element.setAttribute("data-failure", String(failure));
    // Solo recupera el foco perdido (el campo estuvo desactivado); nunca lo quita de otro control.
    const active = document.activeElement;
    if (!active || active === document.body) element.querySelector("input")?.focus();
  }, [failure]);
  return (
    <div className={`secret-field grid gap-1 ${compact ? "credential-input" : ""}`}>
      <label
        htmlFor={id}
        className={`${hideLabel ? "sr-only" : ""} text-xs font-semibold ${compact ? "text-muted" : "text-text"}`}
      >
        {label}
      </label>
      <div
        ref={control}
        data-failure={failure}
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

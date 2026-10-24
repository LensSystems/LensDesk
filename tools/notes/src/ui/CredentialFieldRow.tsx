import { X } from "@lensdesk/ui";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CredentialField } from "./credential-block.ts";
import { SecretField } from "./SecretField.tsx";
export function CredentialFieldRow({
  field,
  autoFocus,
  onChange,
  onRemove,
}: {
  field: CredentialField;
  autoFocus: boolean;
  onChange: (field: CredentialField) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => name.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [autoFocus]);
  return (
    <div className="credential-custom grid gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={name}
          className="min-w-0 max-w-full bg-transparent text-xs leading-[17.4px] font-semibold text-muted [field-sizing:content]"
          aria-label={t("credential.fieldTitle")}
          placeholder={t("credential.fieldTitle")}
          value={field.title}
          onChange={(event) => onChange({ ...field, title: event.target.value })}
        />
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[15.95px] ${field.secret ? "bg-warning-soft text-warning-soft-fg" : "bg-accent-soft text-accent-soft-fg"}`}
        >
          {t(field.secret ? "credential.secret" : "credential.text")}
        </span>
      </div>
      <SecretField
        compact
        hideLabel
        label={field.title || t(field.secret ? "credential.secret" : "credential.text")}
        secret={field.secret}
        mono={field.secret}
        value={field.value}
        onChange={(event) => onChange({ ...field, value: event.target.value })}
        actions={
          <button
            type="button"
            className="field-action"
            aria-label={t("credential.remove")}
            onClick={onRemove}
          >
            <X size={15} aria-hidden="true" />
          </button>
        }
      />
    </div>
  );
}

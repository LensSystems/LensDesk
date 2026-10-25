import { useTranslation } from "react-i18next";

export function PasswordStrength({
  password,
  invalid = false,
  id,
}: {
  password: string;
  invalid?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const count = [...password].length;
  const requirements = [
    { met: count >= 6 && count <= 10, label: t("vault.length") },
    { met: /[A-Z]/.test(password), label: t("vault.uppercase") },
    { met: /[a-z]/.test(password), label: t("vault.lowercase") },
    { met: /[0-9]/.test(password), label: t("vault.number") },
    { met: /[^A-Za-z0-9\s]/.test(password), label: t("vault.special") },
  ];
  const strength = requirements.filter(({ met }) => met).length;
  return (
    <div className="grid gap-1">
      <meter
        className="sr-only"
        aria-label={t("vault.strength")}
        min={0}
        max={5}
        value={strength}
      />
      <div aria-hidden="true" className="flex gap-1">
        {requirements.map((item, index) => (
          <span
            key={item.label}
            className={`h-1 flex-1 rounded-[2px] ${index < strength ? "bg-success" : "bg-border"}`}
          />
        ))}
      </div>
      <p id={id} className="text-xs leading-[17.4px]">
        {requirements.map((item, index) => (
          <span key={item.label}>
            {index > 0 && <span className="text-muted">{t("vault.requirementSeparator")}</span>}
            <span className={item.met ? "text-success" : invalid ? "text-danger" : "text-muted"}>
              {t(item.met ? "vault.requirementMet" : "vault.requirementPending", {
                requirement: item.label,
              })}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

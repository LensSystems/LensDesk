import { useTranslation } from "react-i18next";
import { PasswordStrength } from "./PasswordStrength.tsx";
import { SecretField } from "./SecretField.tsx";
export function PasswordFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
}: {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-1.5">
        <SecretField
          label={t("vault.password")}
          secret
          autoComplete="new-password"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          required
        />
        <PasswordStrength password={password} />
      </div>
      <div className="grid gap-1">
        <SecretField
          label={t("vault.confirmation")}
          secret
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => onConfirmation(event.target.value)}
          required
        />
        {confirmation && (
          <p
            className={`text-xs leading-[17.4px] ${password === confirmation ? "text-success" : "text-muted"}`}
          >
            {t(password === confirmation ? "vault.matches" : "vault.mismatch")}
          </p>
        )}
      </div>
    </>
  );
}

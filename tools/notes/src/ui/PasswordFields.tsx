import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordStrength } from "./PasswordStrength.tsx";
import { validPassword } from "./password-validation.ts";
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
  const id = useId();
  const [touched, setTouched] = useState<[boolean, boolean]>([false, false]);
  const invalid = touched[0] && !validPassword(password, password);
  const mismatch = touched[1] && password !== confirmation;
  return (
    <>
      <div className="grid gap-1.5">
        <SecretField
          invalid={invalid}
          onBlur={() => setTouched(([_, second]) => [true, second])}
          aria-describedby={`${id}-requirements`}
          label={t("vault.password")}
          maxLength={10}
          secret
          autoComplete="new-password"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          required
        />
        <PasswordStrength password={password} invalid={invalid} id={`${id}-requirements`} />
      </div>
      <div className="grid gap-1">
        <SecretField
          invalid={mismatch}
          onBlur={() => setTouched(([first]) => [first, true])}
          aria-describedby={confirmation || mismatch ? `${id}-confirmation` : undefined}
          label={t("vault.confirmation")}
          maxLength={10}
          secret
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => onConfirmation(event.target.value)}
          required
        />
        {(confirmation || mismatch) && (
          <p
            id={`${id}-confirmation`}
            className={`text-xs leading-[17.4px] ${password === confirmation ? "text-success" : "text-danger"}`}
          >
            {t(password === confirmation ? "vault.matches" : "vault.mismatch")}
          </p>
        )}
      </div>
    </>
  );
}

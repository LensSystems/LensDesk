import { Input } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
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
      <p>{t("vault.rules")}</p>
      <Input
        label={t("vault.password")}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => onPassword(event.target.value)}
        required
      />
      <Input
        label={t("vault.confirmation")}
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => onConfirmation(event.target.value)}
        required
      />
    </>
  );
}

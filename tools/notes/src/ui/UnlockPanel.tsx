import { Button, Input, Lock } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
export function UnlockPanel({
  onSubmit,
  onForgot,
  error,
  busy,
}: {
  onSubmit: (password: string) => void;
  onForgot: () => void;
  error: string;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  return (
    <form
      className="grid gap-4 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(password);
        setPassword("");
      }}
    >
      <Lock aria-hidden="true" />
      <p>{t("vault.locked")}</p>
      <Input
        label={t("vault.password")}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !password}>
        {t("vault.unlock")}
      </Button>
      <Button type="button" onClick={onForgot}>
        {t("vault.forgot")}
      </Button>
    </form>
  );
}

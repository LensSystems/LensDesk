import { Button, Lock } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SecretField } from "./SecretField.tsx";
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
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
      <form
        className="unlock-panel grid w-[340px] max-w-full gap-3 text-center"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && password) {
            onSubmit(password);
            setPassword("");
          }
        }}
      >
        <span className="mx-auto flex size-[52px] items-center justify-center rounded-ld-xl bg-accent-soft text-accent-soft-fg">
          <Lock size={24} aria-hidden="true" />
        </span>
        <h3 className="text-[17px] font-bold leading-[24.65px]">{t("vault.locked")}</h3>
        <p className="text-[13px] leading-[18.85px] text-muted">{t("vault.unlockHelp")}</p>
        <div className="text-left">
          <SecretField
            label={t("vault.password")}
            secret
            autoFocus
            autoComplete="current-password"
            className="tracking-[3px]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-left text-xs leading-[17.4px] text-danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          className="h-8 w-full font-semibold"
          disabled={busy || !password}
        >
          {t("vault.unlock")}
        </Button>
        <button type="button" className="text-[13px] text-accent underline" onClick={onForgot}>
          {t("vault.forgot")}
        </button>
        <p className="text-xs leading-[17.4px] text-muted">{t("vault.autoLock")}</p>
      </form>
    </div>
  );
}

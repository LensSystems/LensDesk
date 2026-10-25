import { Button, Lock, TriangleAlert } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExhaustedUnlock } from "./ExhaustedUnlock.tsx";
import { PausedUnlock } from "./PausedUnlock.tsx";
import { SecretField } from "./SecretField.tsx";
import { normalLockout, secondsLeft, type VaultLockout, visibleAttempt } from "./vault-lockout.ts";
export function UnlockPanel({
  onSubmit,
  onForgot,
  error,
  busy,
  lockout = normalLockout,
  onWipe = onForgot,
}: {
  onSubmit: (password: string) => void;
  onForgot: () => void;
  error: string;
  busy: boolean;
  lockout?: VaultLockout;
  onWipe?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [password, setPassword] = useState("");
  const attempt = visibleAttempt(lockout, "password");
  const waiting = attempt.stage === "wait" && secondsLeft(attempt) > 0;
  const blockedPanel =
    attempt.stage === "limit" ? (
      <PausedUnlock {...{ attempt, onForgot, onWipe }} />
    ) : attempt.stage === "exhausted" ? (
      <ExhaustedUnlock onWipe={onWipe} />
    ) : null;
  if (blockedPanel)
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {blockedPanel}
      </div>
    );
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
      <form
        className="unlock-panel grid w-[340px] max-w-full gap-3 text-center"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !waiting && password) {
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
            maxLength={10}
            secret
            autoFocus
            autoComplete="current-password"
            className="tracking-[3px]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy || waiting}
            required
          />
        </div>
        {attempt.stage === "last" && (
          <p className="flex gap-2 text-left text-xs leading-[17.4px] text-warning">
            <TriangleAlert size={14} className="shrink-0" aria-hidden="true" />
            {t("vault.lastPassword")}
          </p>
        )}
        {waiting && (
          <p role="alert" className="text-left text-xs leading-[17.4px] text-danger">
            {t("vault.wait", {
              seconds: new Intl.NumberFormat(i18n.language).format(secondsLeft(attempt)),
            })}
          </p>
        )}
        {error && !waiting && (
          <p role="alert" className="text-left text-xs leading-[17.4px] text-danger">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          className="h-8 w-full font-semibold"
          disabled={busy || waiting || !password}
        >
          {t("vault.unlock")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-[13px] text-accent underline"
          onClick={onForgot}
        >
          {t("vault.forgot")}
        </Button>
        <p className="text-xs leading-[17.4px] text-muted">{t("vault.autoLock")}</p>
      </form>
    </div>
  );
}

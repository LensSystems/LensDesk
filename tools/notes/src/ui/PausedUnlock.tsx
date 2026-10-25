import { Button, Clock, RotateCcw, TriangleAlert } from "@lensdesk/ui";
import { Trans, useTranslation } from "react-i18next";
import { secondsLeft, type VaultAttempt } from "./vault-lockout.ts";
export function PausedUnlock({
  attempt,
  onForgot,
  onWipe,
}: {
  attempt: VaultAttempt;
  onForgot: () => void;
  onWipe: () => void;
}) {
  const { t, i18n } = useTranslation();
  const left = secondsLeft(attempt);
  const number = new Intl.NumberFormat(i18n.language);
  const digits = new Intl.NumberFormat(i18n.language, { minimumIntegerDigits: 2 });
  const minutes = number.format(Math.floor(left / 60));
  const seconds = number.format(left % 60);
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(
    attempt.retryAt ?? Date.now(),
  );
  return (
    <div className="grid w-[360px] max-w-full gap-4 text-center">
      <span className="mx-auto flex size-[52px] items-center justify-center rounded-ld-xl bg-warning-soft text-warning">
        <Clock size={24} aria-hidden="true" />
      </span>
      <div className="grid gap-1">
        <h3 className="text-[17px] font-bold leading-[24.65px]">{t("vault.paused")}</h3>
        <p className="text-[13px] leading-[18.85px] text-muted">{t("vault.pausedHelp")}</p>
      </div>
      <div
        role="timer"
        aria-label={t("vault.timer", { minutes, seconds })}
        className="grid gap-[10px] rounded-ld-lg border border-border bg-bg p-4 text-left"
      >
        <div className="flex justify-between gap-2 text-xs leading-[17.4px] text-muted">
          <span className="font-semibold">{t("vault.timeLeft")}</span>
          <span>{t("vault.availableAt", { time })}</span>
        </div>
        <span className="text-[32px] font-bold leading-10 tabular-nums">
          {digits.format(Math.floor(left / 60))}:{digits.format(left % 60)}
        </span>
        <div className="h-1 overflow-hidden rounded-[2px] bg-border">
          <div
            className="h-full bg-warning"
            style={{ width: `${Math.min(100, Math.max(0, (1 - left / 1800) * 100))}%` }}
          />
        </div>
      </div>
      <div className="flex gap-2 rounded-ld-md bg-warning-soft px-3 py-[10px] text-left text-xs leading-[17.4px] text-warning-soft-fg">
        <TriangleAlert size={16} className="shrink-0" aria-hidden="true" />
        <p>
          <Trans i18nKey="vault.lastHelp" components={{ strong: <strong /> }} />
        </p>
      </div>
      <div className="h-px bg-border" />
      <div className="grid gap-2">
        <p className="text-xs leading-[17.4px] text-muted">{t("vault.cantRemember")}</p>
        <div className="flex gap-2">
          <Button className="h-8 flex-1" onClick={onForgot}>
            {t("vault.useQuestions")}
          </Button>
          <Button className="h-8 flex-1 border-danger bg-transparent text-danger" onClick={onWipe}>
            <RotateCcw size={14} aria-hidden="true" />
            {t("vault.wipeShort")}
          </Button>
        </div>
      </div>
    </div>
  );
}

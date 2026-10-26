import { Button, TriangleAlert } from "@lensdesk/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { validAnswer } from "./answer-validation.ts";
import { PasswordFields } from "./PasswordFields.tsx";
import { validPassword } from "./password-validation.ts";
import { SecretField } from "./SecretField.tsx";
import { useVaultFeedback } from "./use-vault-feedback.ts";
import { VaultDialog } from "./VaultDialog.tsx";
import { normalLockout, secondsLeft, type VaultLockout, visibleAttempt } from "./vault-lockout.ts";
export function ResetPassword({
  questions,
  onClose,
  onSubmit,
  error,
  busy,
  lockout = normalLockout,
}: {
  questions: string[];
  onClose: () => void;
  onSubmit: (password: string, answers: [string, string]) => void;
  error: string;
  busy: boolean;
  lockout?: VaultLockout;
}) {
  const { t, i18n } = useTranslation();
  const failure = useVaultFeedback(busy, error, lockout.recovery.failures);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [answers, setAnswers] = useState<[string, string]>(["", ""]);
  const answerId = useId();
  const [touched, setTouched] = useState([false, false]);
  const invalidAnswers = answers.map((answer, index) => touched[index] && !validAnswer(answer));
  const valid = validPassword(password, confirmation) && answers.every(validAnswer);
  const attempt = visibleAttempt(lockout, "recovery");
  const left = secondsLeft(attempt);
  const waiting = (attempt.stage === "wait" || attempt.stage === "limit") && left > 0;
  const blocked = waiting || attempt.stage === "exhausted";
  const number = new Intl.NumberFormat(i18n.language);
  return (
    <VaultDialog title={t("vault.reset")} onClose={onClose}>
      <form
        className="grid gap-[14px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !blocked && valid) onSubmit(password, answers);
        }}
      >
        {([0, 1] as const).map((index) => (
          <SecretField
            invalid={invalidAnswers[index]}
            onBlur={() => setTouched((old) => old.map((value, i) => value || i === index))}
            aria-describedby={answerId}
            key={index}
            label={questions[index] ?? ""}
            maxLength={20}
            required
            value={answers[index]}
            onChange={(event) =>
              setAnswers((old) =>
                index === 0 ? [event.target.value, old[1]] : [old[0], event.target.value],
              )
            }
          />
        ))}
        <PasswordFields
          {...{ password, confirmation }}
          failure={failure}
          onPassword={setPassword}
          onConfirmation={setConfirmation}
        />
        <p
          id={answerId}
          className={`text-xs ${invalidAnswers.some(Boolean) ? "text-danger" : "text-muted"}`}
        >
          {t("vault.answerLength")}
        </p>
        {attempt.stage === "last" && (
          <p className="flex gap-2 text-xs leading-[17.4px] text-warning">
            <TriangleAlert size={14} className="shrink-0" aria-hidden="true" />
            {t("vault.lastAnswers")}
          </p>
        )}
        {waiting && (
          <p role="alert" className="text-xs text-danger">
            {attempt.stage === "limit"
              ? t("vault.waitMinutes", { minutes: number.format(Math.ceil(left / 60)) })
              : t("vault.wait", { seconds: number.format(left) })}
          </p>
        )}
        {error && !waiting && (
          <p key={failure} role="alert" className="vault-error text-xs text-danger">
            {error}
          </p>
        )}
        <footer className="vault-footer">
          <Button type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || blocked || !valid}>
            {t("vault.reset")}
          </Button>
        </footer>
      </form>
    </VaultDialog>
  );
}

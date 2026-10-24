import { Button } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { validAnswer } from "./answer-validation.ts";
import { PasswordFields } from "./PasswordFields.tsx";
import { validPassword } from "./password-validation.ts";
import { SecretField } from "./SecretField.tsx";
import { VaultDialog } from "./VaultDialog.tsx";
export function ResetPassword({
  questions,
  onClose,
  onSubmit,
  error,
  busy,
}: {
  questions: string[];
  onClose: () => void;
  onSubmit: (password: string, answers: [string, string]) => void;
  error: string;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [answers, setAnswers] = useState<[string, string]>(["", ""]);
  const valid = validPassword(password, confirmation) && answers.every(validAnswer);
  return (
    <VaultDialog title={t("vault.reset")} onClose={onClose}>
      <form
        className="grid gap-[14px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && valid) onSubmit(password, answers);
        }}
      >
        {([0, 1] as const).map((index) => (
          <SecretField
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
          onPassword={setPassword}
          onConfirmation={setConfirmation}
        />
        <p className="text-xs text-muted">{t("vault.answerLength")}</p>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <footer className="vault-footer">
          <Button type="button" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !valid}>
            {t("vault.reset")}
          </Button>
        </footer>
      </form>
    </VaultDialog>
  );
}

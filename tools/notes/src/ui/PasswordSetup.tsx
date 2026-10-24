import { Button } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { validAnswer } from "./answer-validation.ts";
import { PasswordFields } from "./PasswordFields.tsx";
import { validPassword } from "./password-validation.ts";
import { SecurityQuestion } from "./SecurityQuestion.tsx";
import { VaultDialog } from "./VaultDialog.tsx";
export function PasswordSetup({
  onClose,
  onBack,
  onSubmit,
  error,
  busy,
}: {
  onClose: () => void;
  onBack: () => void;
  onSubmit: (password: string, questions: [string, string], answers: [string, string]) => void;
  error: string;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [questions, setQuestions] = useState<[string, string]>(["pet", "city"]);
  const [answers, setAnswers] = useState<[string, string]>(["", ""]);
  const valid = validPassword(password, confirmation) && answers.every(validAnswer);
  return (
    <VaultDialog title={t("vault.setup")} onClose={onClose}>
      <p className="-mt-3 text-xs leading-[17.4px] text-muted">{t("vault.steps")}</p>
      <form
        className="grid gap-[14px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && valid)
            onSubmit(
              password,
              [t(`vault.questions.${questions[0]}`), t(`vault.questions.${questions[1]}`)],
              answers,
            );
        }}
      >
        <PasswordFields
          {...{ password, confirmation }}
          onPassword={setPassword}
          onConfirmation={setConfirmation}
        />
        <hr className="border-border" />
        <p className="text-[13px] text-muted">{t("vault.questionsHelp")}</p>
        {([0, 1] as const).map((index) => (
          <SecurityQuestion
            key={index}
            index={index}
            question={questions[index]}
            excluded={questions[1 - index] ?? ""}
            answer={answers[index]}
            onQuestion={(value) =>
              setQuestions((old) => (index === 0 ? [value, old[1]] : [old[0], value]))
            }
            onAnswer={(value) =>
              setAnswers((old) => (index === 0 ? [value, old[1]] : [old[0], value]))
            }
          />
        ))}
        <p className="text-xs text-muted">{t("vault.answerLength")}</p>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <footer className="vault-footer">
          <Button onClick={onBack} type="button">
            {t("vault.back")}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !valid}>
            {t("vault.saveLock")}
          </Button>
        </footer>
      </form>
    </VaultDialog>
  );
}

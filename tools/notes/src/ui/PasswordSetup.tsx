import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordFields } from "./PasswordFields.tsx";
import { validPassword } from "./password-validation.ts";
import { VaultDialog } from "./VaultDialog.tsx";
export function PasswordSetup({
  onClose,
  onSubmit,
  error,
  busy,
}: {
  onClose: () => void;
  onSubmit: (password: string, questions: [string, string], answers: [string, string]) => void;
  error: string;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [questions, setQuestions] = useState<[string, string]>(["", ""]);
  const [answers, setAnswers] = useState<[string, string]>(["", ""]);
  return (
    <VaultDialog title={t("vault.setup")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (validPassword(password, confirmation)) onSubmit(password, questions, answers);
        }}
      >
        <PasswordFields
          {...{ password, confirmation }}
          onPassword={setPassword}
          onConfirmation={setConfirmation}
        />
        {([0, 1] as const).map((index) => (
          <div key={index} className="grid gap-2">
            <Input
              label={t("vault.question", { number: index + 1 })}
              value={questions[index]}
              required
              onChange={(event) =>
                setQuestions((old) =>
                  index === 0 ? [event.target.value, old[1]] : [old[0], event.target.value],
                )
              }
            />
            <Input
              label={t("vault.answer", { number: index + 1 })}
              type="password"
              value={answers[index]}
              required
              onChange={(event) =>
                setAnswers((old) =>
                  index === 0 ? [event.target.value, old[1]] : [old[0], event.target.value],
                )
              }
            />
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
        <Button
          type="submit"
          disabled={
            busy ||
            !validPassword(password, confirmation) ||
            [...questions, ...answers].some((value) => !value.trim())
          }
        >
          {t("vault.setup")}
        </Button>
      </form>
    </VaultDialog>
  );
}

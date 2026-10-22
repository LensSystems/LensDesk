import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PasswordFields } from "./PasswordFields.tsx";
import { validPassword } from "./password-validation.ts";
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
  return (
    <VaultDialog title={t("vault.reset")} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (validPassword(password, confirmation)) onSubmit(password, answers);
        }}
      >
        {([0, 1] as const).map((index) => (
          <Input
            key={index}
            label={questions[index]}
            type="password"
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
        {error && <p role="alert">{error}</p>}
        <Button
          type="submit"
          disabled={
            busy || !validPassword(password, confirmation) || answers.some((value) => !value.trim())
          }
        >
          {t("vault.reset")}
        </Button>
      </form>
    </VaultDialog>
  );
}

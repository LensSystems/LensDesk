import {
  ChevronDown,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lensdesk/ui";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SecretField } from "./SecretField.tsx";
export const questionKeys = ["pet", "city", "school", "friend", "street", "job"] as const;
export function SecurityQuestion({
  index,
  question,
  excluded,
  answer,
  onQuestion,
  onAnswer,
}: {
  index: number;
  question: string;
  excluded: string;
  answer: string;
  onQuestion: (value: string) => void;
  onAnswer: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <div className="grid gap-1">
        <label htmlFor={id} className="text-xs leading-[17.4px] font-semibold">
          {t("vault.question", { number: index + 1 })}
        </label>
        <Select value={question} onValueChange={onQuestion}>
          <SelectTrigger
            id={id}
            className="question-select h-[38px] w-full gap-1.5 bg-bg pr-2.5 text-[13px]"
            icon={<ChevronDown size={15} className="text-muted" />}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {questionKeys
              .filter((key) => key !== excluded)
              .map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`vault.questions.${key}`)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <SecretField
        hideLabel
        label={t("vault.answer", { number: index + 1 })}
        placeholder={t("vault.answerPlaceholder")}
        value={answer}
        onChange={(event) => onAnswer(event.target.value)}
        required
      />
    </div>
  );
}

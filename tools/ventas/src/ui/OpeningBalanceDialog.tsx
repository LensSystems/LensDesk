import { Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientRecord } from "../shared/trading-contracts.ts";
import { parseMoney } from "./format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { OperationModal } from "./OperationModal.tsx";
import type { ScreenProps } from "./types.ts";
export function OpeningBalanceDialog({
  client,
  close,
  ...props
}: ScreenProps & { client: ClientRecord; close: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  return (
    <OperationModal
      {...props}
      title={t("openingBalance")}
      description={t("openingBalanceIntro")}
      label={t("recordBalance")}
      close={close}
      onSubmit={(form) => ({
        type: "openingBalance",
        clientId: client.id,
        amount: parseMoney(amount),
        due: String(form.get("due")),
        note: String(form.get("note")),
      })}
    >
      <MoneyInput label={t("amount")} value={amount} onChange={setAmount} />
      <Input label={t("dueDate")} name="due" type="date" required defaultValue={props.data.today} />
      <Input label={t("reason")} name="note" required maxLength={500} />
    </OperationModal>
  );
}

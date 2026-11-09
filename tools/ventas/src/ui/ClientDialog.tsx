import { type DialogContentProps, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientRecord } from "../shared/trading-contracts.ts";
import { parseMoney } from "./format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { OperationModal } from "./OperationModal.tsx";
import type { ScreenProps } from "./types.ts";

export function ClientDialog({
  client,
  close,
  onSaved,
  onCloseAutoFocus,
  initialName = "",
  ...props
}: ScreenProps & {
  client?: ClientRecord;
  close: () => void;
  onSaved?: (id: string) => void;
  onCloseAutoFocus?: DialogContentProps["onCloseAutoFocus"];
  initialName?: string;
}) {
  const { t } = useTranslation();
  const [term] = useState(() => client?.term ?? props.data.settings.defaultTerm ?? 15);
  const [limit, setLimit] = useState(
    client?.limit === null || !client ? "" : (client.limit / 100).toFixed(2),
  );
  return (
    <OperationModal
      {...props}
      title={t(client ? "editClient" : "addClient")}
      description={t("clientIntro")}
      label={t("save")}
      close={close}
      onSaved={onSaved}
      onCloseAutoFocus={onCloseAutoFocus}
      onSubmit={(form) => ({
        type: "saveClient",
        client: {
          ...(client ? { id: client.id } : {}),
          name: String(form.get("name")),
          phone: String(form.get("phone")),
          term: Number(form.get("term")),
          limit: limit === "" ? null : parseMoney(limit),
        },
      })}
    >
      <Input
        label={t("clientName")}
        name="name"
        required
        maxLength={120}
        defaultValue={client?.name ?? initialName}
      />
      <Input label={t("phone")} name="phone" maxLength={40} defaultValue={client?.phone ?? ""} />
      <Input
        label={t("paymentDays")}
        name="term"
        type="number"
        min={1}
        max={30}
        required
        defaultValue={term}
      />
      <MoneyInput label={t("creditLimit")} value={limit} onChange={setLimit} required={false} />
    </OperationModal>
  );
}

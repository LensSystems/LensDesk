import { type DialogContentProps, Input } from "@lensdesk/ui";
import { Store } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientRecord } from "../shared/trading-contracts.ts";
import { Choice } from "./Choice.tsx";
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
  const [creditMode, setCreditMode] = useState(client?.limit != null ? "limited" : "unlimited");
  const [term, setTerm] = useState(() =>
    String(client?.term ?? props.data.settings.defaultTerm ?? 15),
  );
  const [limit, setLimit] = useState(
    client?.limit === null || !client ? "" : (client.limit / 100).toFixed(2),
  );
  return (
    <OperationModal
      {...props}
      presentationClass="ventas-p3-dialog ventas-p3-fields"
      icon={<Store size={21} aria-hidden="true" />}
      cancelLabel={t("cancel")}
      title={t(client ? "editClient" : "addClient")}
      description={t("clientIntro")}
      label={t(client ? "saveClientChanges" : "addClient")}
      close={close}
      onSaved={onSaved}
      onCloseAutoFocus={onCloseAutoFocus}
      onSubmit={(form) => ({
        type: "saveClient",
        client: {
          ...(client ? { id: client.id } : {}),
          name: String(form.get("name")),
          phone: String(form.get("phone")),
          term: Number(term),
          limit: creditMode === "unlimited" ? null : limit === "" ? 0 : parseMoney(limit),
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
      <Input
        label={t("clientPhone")}
        name="phone"
        maxLength={40}
        defaultValue={client?.phone ?? ""}
      />
      <Choice
        label={t("clientPaymentDays")}
        value={term}
        onChange={setTerm}
        options={Array.from({ length: 30 }, (_, index) => ({
          value: String(index + 1),
          label: t("termDays", { count: index + 1 }),
        }))}
      />
      <Choice
        label={t("creditControl")}
        value={creditMode}
        onChange={setCreditMode}
        options={[
          { value: "unlimited", label: t("unlimitedCredit") },
          { value: "limited", label: t("defineCreditLimit") },
        ]}
      />
      <MoneyInput
        label={t("creditLimitOptional")}
        value={limit}
        onChange={setLimit}
        required={false}
      />
    </OperationModal>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { statementSchema } from "../shared/history-contracts.ts";
import { bankLabel, defaultBank } from "../shared/values.ts";
import { Choice } from "./Choice.tsx";
import { Pager } from "./Pager.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import { StatementTicket } from "./StatementTicket.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function StatementView({ clientId, ...props }: ScreenProps & { clientId: string }) {
  const { t } = useTranslation(),
    [bank, setBank] = useState(defaultBank(props.data.settings) ?? "none");
  const key = JSON.stringify([clientId, bank, props.data.revision]);
  const [salesOffset, setSalesOffset] = useOffset(key),
    [paymentOffset, setPaymentOffset] = useOffset(key),
    [returnOffset, setReturnOffset] = useOffset(key);
  const q = useQuery(
    props.read,
    "statement",
    {
      clientId,
      bankId: bank === "none" ? null : bank,
      salesOffset,
      paymentOffset,
      returnOffset,
      revision: props.data.revision,
    },
    statementSchema,
  );
  return (
    <div className="ventas-statement-view">
      <Choice
        label={t("statementBank")}
        value={bank}
        onChange={setBank}
        options={[
          { value: "none", label: t("noBankSelected") },
          ...props.data.settings.banks.map((b) => ({ value: b.id, label: bankLabel(b) })),
        ]}
      />
      <QueryNotice
        issue={q.issue}
        loading={q.loading}
        retry={() => {
          setSalesOffset(0);
          setPaymentOffset(0);
          setReturnOffset(0);
          q.retry();
        }}
      />
      {q.value ? (
        <>
          <StatementTicket statement={q.value} read={props.read} />
          <h3>{t("purchasesAndDue")}</h3>
          <Pager page={q.value.salesPage} offset={salesOffset} limit={10} onPage={setSalesOffset} />
          <h3>{t("payments")}</h3>
          <Pager
            page={q.value.payments}
            offset={paymentOffset}
            limit={10}
            onPage={setPaymentOffset}
          />
          <h3>{t("returns")}</h3>
          <Pager page={q.value.returns} offset={returnOffset} limit={10} onPage={setReturnOffset} />
        </>
      ) : null}
    </div>
  );
}

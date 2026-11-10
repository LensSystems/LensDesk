import { useTranslation } from "react-i18next";
import { type HistoryRow, historyPageSchema } from "../shared/history-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";

type Payment = Extract<HistoryRow, { kind: "payment" }>["data"];
export function AccountAllocations({
  payment,
  ...props
}: Pick<ScreenProps, "read" | "data"> & { payment: Payment }) {
  const { t, i18n } = useTranslation(),
    [offset, setOffset] = useOffset(`${payment.id}:${props.data.revision}`);
  const q = useQuery(
    props.read,
    "history",
    {
      kind: "payments",
      paymentId: payment.id,
      allocationOffset: offset,
      limit: 1,
      revision: props.data.revision,
    },
    historyPageSchema,
  );
  const row = q.value?.rows[0],
    page = row?.kind === "payment" ? row.data.allocationPage : null;
  return (
    <section aria-label={t("paymentAllocations")}>
      <QueryNotice issue={q.issue} loading={q.loading} retry={q.retry} />
      {page?.rows.map((a) => (
        <small key={a.saleId}>
          {saleFolio(a)}: {moneyText(a.amount, i18n.language)}
          {a.historyMissing?.length ? ` · ${t("historicalUnavailable")}` : ""}
        </small>
      ))}
      <Pager
        page={page ?? null}
        offset={offset}
        limit={50}
        loading={q.loading}
        onPage={setOffset}
      />
      <span className="sr-only">{dateText(payment.date, i18n.language)}</span>
    </section>
  );
}

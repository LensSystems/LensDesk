import { Button } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type SaleDetail, saleDetailSchema } from "../shared/history-contracts.ts";
import { HistoryRow } from "./HistoryRow.tsx";
import { Pager } from "./Pager.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import { ReturnDialog } from "./ReturnDialog.tsx";
import { ReversePaymentDialog } from "./ReversePaymentDialog.tsx";
import { SaleTicket } from "./SaleTicket.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function SaleDetailView({ saleId, ...props }: ScreenProps & { saleId: string }) {
  const { t } = useTranslation(),
    [returnDetail, setReturnDetail] = useState<SaleDetail | null>(null),
    [reverse, setReverse] = useState<string | null>(null);
  const key = JSON.stringify([saleId, props.data.revision]);
  const [paymentOffset, setPaymentOffset] = useOffset(key),
    [returnOffset, setReturnOffset] = useOffset(key);
  const query = useQuery(
      props.read,
      "saleDetail",
      { saleId, paymentOffset, returnOffset, revision: props.data.revision },
      saleDetailSchema,
    ),
    detail = query.value;
  const canReturn =
    detail &&
    !detail.sale.opening &&
    detail.sale.lines.some(
      (l) => l.qty > (detail.returned.find((r) => r.lineId === l.id)?.qty ?? 0),
    );
  return (
    <div className="ventas-detail-view">
      <QueryNotice
        issue={query.issue}
        loading={query.loading}
        retry={() => {
          setPaymentOffset(0);
          setReturnOffset(0);
          query.retry();
        }}
      />
      {detail ? (
        <>
          <SaleTicket detail={detail} />
          {canReturn ? (
            <Button disabled={props.busy} onClick={() => setReturnDetail(detail)}>
              {t("returnOrCancel")}
            </Button>
          ) : null}
          <h3>{t("payments")}</h3>
          {detail.payments.rows.map((row) => (
            <HistoryRow key={row.data.id} row={row} onReverse={setReverse} />
          ))}
          <Pager
            page={detail.payments}
            offset={paymentOffset}
            limit={10}
            onPage={setPaymentOffset}
          />
          <h3>{t("returns")}</h3>
          {detail.returns.rows.map((row) => (
            <HistoryRow
              key={row.data.id}
              row={row}
              read={props.read}
              revision={props.data.revision}
            />
          ))}
          <Pager page={detail.returns} offset={returnOffset} limit={10} onPage={setReturnOffset} />
        </>
      ) : null}
      {returnDetail ? (
        <ReturnDialog {...props} detail={returnDetail} close={() => setReturnDetail(null)} />
      ) : null}
      {reverse ? (
        <ReversePaymentDialog {...props} paymentId={reverse} close={() => setReverse(null)} />
      ) : null}
    </div>
  );
}

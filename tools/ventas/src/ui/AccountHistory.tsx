import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { ReversePaymentDialog } from "./ReversePaymentDialog.tsx";
import { SaleDetailDialog } from "./SaleDetailDialog.tsx";
import type { ScreenProps } from "./types.ts";
export function AccountHistory({ clientId, ...props }: ScreenProps & { clientId: string }) {
  const { t } = useTranslation(),
    [sale, setSale] = useState<string | null>(null),
    [reverse, setReverse] = useState<string | null>(null);
  return (
    <>
      <h2>{t("purchasesAndDue")}</h2>
      <HistoryPanel {...props} kind="sales" clientId={clientId} onSale={setSale} />
      <h2>{t("payments")}</h2>
      <HistoryPanel {...props} kind="payments" clientId={clientId} onReverse={setReverse} />
      {sale ? <SaleDetailDialog {...props} saleId={sale} close={() => setSale(null)} /> : null}
      {reverse ? (
        <ReversePaymentDialog {...props} paymentId={reverse} close={() => setReverse(null)} />
      ) : null}
    </>
  );
}

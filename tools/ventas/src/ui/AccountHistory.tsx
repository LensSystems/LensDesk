import { useState } from "react";
import { AccountPayments } from "./AccountPayments.tsx";
import { AccountPurchases } from "./AccountPurchases.tsx";
import { ReversePaymentDialog } from "./ReversePaymentDialog.tsx";
import { SaleDetailDialog } from "./SaleDetailDialog.tsx";
import type { ScreenProps } from "./types.ts";
export function AccountHistory({ clientId, ...props }: ScreenProps & { clientId: string }) {
  const [sale, setSale] = useState<string | null>(null),
    [reverse, setReverse] = useState<string | null>(null);
  return (
    <>
      <AccountPurchases {...props} clientId={clientId} onSale={setSale} />
      <AccountPayments {...props} clientId={clientId} onReverse={setReverse} />
      {sale ? <SaleDetailDialog {...props} saleId={sale} close={() => setSale(null)} /> : null}
      {reverse ? (
        <ReversePaymentDialog {...props} paymentId={reverse} close={() => setReverse(null)} />
      ) : null}
    </>
  );
}

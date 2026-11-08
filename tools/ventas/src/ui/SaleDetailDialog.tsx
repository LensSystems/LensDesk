import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { SaleDetailView } from "./SaleDetailView.tsx";
import type { ScreenProps } from "./types.ts";
export function SaleDetailDialog({
  saleId,
  close,
  ...props
}: ScreenProps & { saleId: string; close: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.operation.writing) close();
      }}
    >
      <DialogContent className="ventas-detail-dialog">
        <DialogTitle>{t("saleDetail")}</DialogTitle>
        <DialogDescription>{t("ticketOriginalPreserved")}</DialogDescription>
        <SaleDetailView {...props} saleId={saleId} />
      </DialogContent>
    </Dialog>
  );
}

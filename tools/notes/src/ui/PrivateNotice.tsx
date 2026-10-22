import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { VaultDialog } from "./VaultDialog.tsx";
export function PrivateNotice({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <VaultDialog title={t("vault.noticeTitle")} onClose={onClose}>
      <p>{t("vault.notice")}</p>
      <Button onClick={onContinue}>{t("vault.continue")}</Button>
    </VaultDialog>
  );
}

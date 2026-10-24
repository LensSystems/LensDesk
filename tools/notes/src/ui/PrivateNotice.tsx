import { Button, CircleHelp, Lock, ShieldCheck, TriangleAlert } from "@lensdesk/ui";
import { Trans, useTranslation } from "react-i18next";
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
    <VaultDialog
      title={t("vault.noticeTitle")}
      onClose={onClose}
      notice
      titleIcon={<Lock size={20} aria-hidden="true" />}
    >
      <p className="text-[13px] text-muted">{t("vault.notice")}</p>
      <ul className="grid gap-4 text-[13px] leading-[18.85px]">
        <li className="flex gap-2.5">
          <ShieldCheck size={16} className="shrink-0 text-accent" aria-hidden="true" />
          <span>{t("vault.noticeLocal")}</span>
        </li>
        <li className="flex gap-2.5">
          <CircleHelp size={16} className="shrink-0 text-accent" aria-hidden="true" />
          <span>{t("vault.noticeQuestions")}</span>
        </li>
        <li className="flex gap-2.5 text-warning-soft-fg">
          <TriangleAlert size={16} className="shrink-0 text-warning" aria-hidden="true" />
          <span>
            <Trans i18nKey="vault.noticeLoss" components={{ strong: <strong /> }} />
          </span>
        </li>
      </ul>
      <footer className="vault-footer">
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button variant="primary" onClick={onContinue}>
          {t("vault.setup")}
        </Button>
      </footer>
    </VaultDialog>
  );
}

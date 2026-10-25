import { Button, Clock, Lock, RotateCcw } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { VaultDialog } from "./VaultDialog.tsx";
export function AttemptLimitNotice({
  onClose,
  onWipe,
}: {
  onClose: () => void;
  onWipe: () => void;
}) {
  const { t } = useTranslation();
  return (
    <VaultDialog
      notice
      title={t("vault.limitTitle")}
      titleTone="danger"
      titleIcon={<Lock size={20} aria-hidden="true" />}
      onClose={onClose}
    >
      <p className="text-[13px] leading-[18.85px] text-muted">{t("vault.limitHelp")}</p>
      <div className="grid gap-[14px] rounded-ld-lg border border-border bg-bg p-[14px]">
        {(["tryLater", "wipe"] as const).map((option, index) => (
          <div
            key={option}
            className={`grid grid-cols-[32px_1fr] gap-3 ${index ? "border-t border-border pt-[14px]" : ""}`}
          >
            <span className="flex size-8 items-center justify-center rounded-ld-md border border-border bg-surface">
              {index ? (
                <RotateCcw size={16} className="text-danger" aria-hidden="true" />
              ) : (
                <Clock size={16} className="text-warning" aria-hidden="true" />
              )}
            </span>
            <div className="text-[13px] leading-[18.85px]">
              <p className="font-semibold">{t(`vault.${option}`)}</p>
              <p className="text-muted">
                {t(index ? "vault.wipeOptionHelp" : "vault.tryLaterHelp")}
              </p>
            </div>
          </div>
        ))}
      </div>
      <footer className="flex justify-between gap-2">
        <Button
          size="lg"
          className="whitespace-nowrap border-danger bg-transparent text-danger"
          onClick={onWipe}
        >
          {t("vault.wipe")}
        </Button>
        <Button
          size="lg"
          variant="primary"
          className="whitespace-nowrap"
          onClick={onClose}
          // La opción segura recibe el foco al abrir.
          autoFocus
        >
          {t("vault.tryLater")}
        </Button>
      </footer>
    </VaultDialog>
  );
}

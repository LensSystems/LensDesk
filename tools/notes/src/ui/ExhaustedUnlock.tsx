import { Button, Lock } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
export function ExhaustedUnlock({ onWipe }: { onWipe: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid w-[340px] max-w-full gap-3 text-center">
      <span className="mx-auto flex size-[52px] items-center justify-center rounded-ld-xl bg-accent-soft text-accent-soft-fg">
        <Lock size={24} aria-hidden="true" />
      </span>
      <h3 className="text-[17px] font-bold leading-[24.65px]">{t("vault.exhausted")}</h3>
      <p className="text-[13px] leading-[18.85px] text-muted">{t("vault.exhaustedHelp")}</p>
      <Button variant="danger" className="h-8 w-full" onClick={onWipe}>
        {t("vault.wipe")}
      </Button>
    </div>
  );
}

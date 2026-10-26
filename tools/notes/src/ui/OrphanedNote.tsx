import { Lock } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
export function OrphanedNote() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
      <div className="grid w-[340px] max-w-full gap-3 text-center">
        <span className="mx-auto flex size-[52px] items-center justify-center rounded-ld-xl bg-accent-soft text-accent-soft-fg">
          <Lock size={24} aria-hidden="true" />
        </span>
        <h3 className="text-[17px] font-bold leading-[24.65px]">{t("vault.orphanedTitle")}</h3>
        <p className="text-[13px] leading-[18.85px] text-muted">{t("vault.orphanedHelp")}</p>
      </div>
    </div>
  );
}

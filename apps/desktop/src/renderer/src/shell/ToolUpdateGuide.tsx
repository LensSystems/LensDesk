import { RefreshCw } from "@lensdesk/ui";
import { Trans, useTranslation } from "react-i18next";

export function ToolUpdateGuide() {
  const { t, i18n } = useTranslation();
  return (
    <section
      aria-labelledby="tool-update-guide"
      className="rounded-ld-lg border border-border bg-surface pb-4 text-[13px] leading-5 text-muted"
    >
      <h2
        id="tool-update-guide"
        className="px-4 pt-3 flex items-center gap-2 text-xs leading-4 font-bold uppercase"
      >
        <RefreshCw aria-hidden size={14} />
        {t("toolsPage.updateGuideTitle")}
      </h2>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 pt-3">
        {[1, 2, 3, 4].map((step) => (
          <li key={step} className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-soft-fg"
            >
              {new Intl.NumberFormat(i18n.resolvedLanguage).format(step)}
            </span>
            <span>
              <Trans
                i18nKey={`toolsPage.updateGuideStep${step}`}
                components={{ strong: <strong className="font-bold" /> }}
              />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

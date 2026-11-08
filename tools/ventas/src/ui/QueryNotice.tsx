import { Notice } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
export function QueryNotice({
  issue,
  loading,
  retry,
}: {
  issue: string | null;
  loading: boolean;
  retry: () => void;
}) {
  const { t } = useTranslation();
  return issue ? (
    <Notice
      tone="danger"
      title={t(`errors.${issue}`, { defaultValue: t("errors.E_INTERNAL") })}
      action={{ label: t("retry"), onClick: retry }}
    />
  ) : loading ? (
    <p role="status">{t("loading")}</p>
  ) : null;
}

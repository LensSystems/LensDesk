import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
export function Pager({
  page,
  offset,
  limit,
  onPage,
  loading = false,
}: {
  page: { total: number; nextOffset: number | null; rows: readonly unknown[] } | null;
  offset: number;
  limit: number;
  onPage: (offset: number) => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="ventas-pager">
      <Button
        disabled={loading || offset === 0}
        onClick={() => onPage(Math.max(0, offset - limit))}
      >
        {t("previousPage")}
      </Button>
      <span aria-live="polite">
        {page
          ? t("historyRange", {
              from: page.total ? offset + 1 : 0,
              to: offset + page.rows.length,
              total: page.total,
            })
          : t("loading")}
      </span>
      <Button
        disabled={loading || !page || page.nextOffset === null}
        onClick={() => {
          if (page?.nextOffset !== null && page?.nextOffset !== undefined) onPage(page.nextOffset);
        }}
      >
        {t("nextPage")}
      </Button>
    </div>
  );
}

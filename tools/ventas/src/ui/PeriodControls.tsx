import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { addDays } from "../shared/calendar.ts";
export type Period = "today" | "week" | "month" | "all";
export function periodRange(today: string, period: Period) {
  return period === "all"
    ? {}
    : {
        from:
          period === "week"
            ? addDays(today, -6)
            : period === "month"
              ? `${today.slice(0, 7)}-01`
              : today,
        to: today,
      };
}
export function PeriodControls({
  value,
  onChange,
  all = true,
}: {
  value: Period;
  onChange: (value: Period) => void;
  all?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="ventas-category-list" aria-label={t("period")}>
      {(["today", "week", "month", ...(all ? ["all"] : [])] as Period[]).map((p) => (
        <Button key={p} aria-pressed={p === value} onClick={() => onChange(p)}>
          {t(`periods.${p}`)}
        </Button>
      ))}
    </fieldset>
  );
}

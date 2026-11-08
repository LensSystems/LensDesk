import { Button, SegmentedControl } from "@lensdesk/ui";
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
  segmented = false,
}: {
  value: Period;
  onChange: (value: Period) => void;
  all?: boolean;
  segmented?: boolean;
}) {
  const { t } = useTranslation();
  if (segmented)
    return (
      <SegmentedControl
        aria-label={t("period")}
        value={value}
        onValueChange={(value) => onChange(value as Period)}
        options={(["today", "week", "month"] as const).map((p) => ({
          value: p,
          label: t(p === "week" ? "summaryWeek" : `periods.${p}`),
        }))}
      />
    );
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

import { Button, Input } from "@lensdesk/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { historyPageSchema } from "../shared/history-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { type Period, PeriodControls, periodRange } from "./PeriodControls.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";

export function TicketList({
  selected,
  onSelect,
  autoSelect,
  ...props
}: ScreenProps & {
  selected: string | null;
  autoSelect: boolean;
  onSelect: (id: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useOffset(JSON.stringify([props.data.revision, props.data.today]));
  const query = useQuery(
    props.read,
    "history",
    {
      kind: "sales",
      excludeOpening: true,
      query: search,
      offset,
      limit: 20,
      revision: props.data.revision,
      ...periodRange(props.data.today, period),
    },
    historyPageSchema,
  );
  useEffect(() => {
    const first = query.value?.rows.find((row) => row.kind === "sale");
    if (autoSelect && !selected && first) onSelect(first.data.id);
  }, [autoSelect, selected, query.value, onSelect]);
  return (
    <>
      <h2>{t("tickets")}</h2>
      <Input
        label={t("searchHistory")}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.slice(0, 120));
          setOffset(0);
          onSelect(null);
        }}
        maxLength={120}
        type="search"
      />
      <PeriodControls
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setOffset(0);
          onSelect(null);
        }}
      />
      <QueryNotice
        issue={query.issue}
        loading={query.loading}
        retry={() => {
          setOffset(0);
          query.retry();
        }}
      />
      <div className="ventas-ticket-choices">
        {query.value?.rows.map((row) =>
          row.kind === "sale" ? (
            <Button
              key={row.data.id}
              className="ventas-ticket-choice"
              aria-current={selected === row.data.id ? "true" : undefined}
              onClick={() => onSelect(row.data.id)}
            >
              <span>
                <strong>{saleFolio(row.data)}</strong>
                <strong>{moneyText(row.data.net, i18n.language)}</strong>
              </span>
              <small>
                {dateText(row.data.date, i18n.language)} ·{" "}
                {row.data.clientId
                  ? row.data.clientName || t("historicalUnavailable")
                  : t("counter")}
              </small>
            </Button>
          ) : null,
        )}
        {query.value && !query.value.rows.length ? (
          <p className="ventas-checkout-note">{t("noConfirmedSales")}</p>
        ) : null}
      </div>
      <Pager
        page={query.value}
        offset={offset}
        limit={20}
        loading={query.loading}
        onPage={(n) => {
          setOffset(n);
          onSelect(null);
        }}
      />
    </>
  );
}

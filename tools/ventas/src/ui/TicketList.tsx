import { Button, Input } from "@lensdesk/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { historyPageSchema } from "../shared/history-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { PeriodControls, periodRange } from "./PeriodControls.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { TicketWorkspace } from "./ticket-workspace.ts";
import type { ScreenProps } from "./types.ts";
import { useQuery } from "./use-query.ts";

export function TicketList({
  selected,
  onSelect,
  autoSelect,
  filters,
  onFilters,
  ...props
}: ScreenProps & {
  selected: string | null;
  autoSelect: boolean;
  filters: TicketWorkspace["query"];
  onFilters: (query: TicketWorkspace["query"]) => void;
  onSelect: (id: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const { period, search, offset } = filters;
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
    if (autoSelect && !selected && query.value) onSelect(first?.data.id ?? null);
  }, [autoSelect, selected, query.value, onSelect]);
  useEffect(() => {
    if (query.value && offset > 0 && offset >= query.value.total)
      onFilters({ ...filters, offset: Math.max(0, Math.ceil(query.value.total / 20) - 1) * 20 });
  }, [query.value, offset, filters, onFilters]);
  return (
    <>
      <h2>{t("tickets")}</h2>
      <Input
        label={t("searchHistory")}
        value={search}
        onChange={(e) => {
          onFilters({ ...filters, search: e.target.value.slice(0, 120), offset: 0 });
        }}
        maxLength={120}
        type="search"
      />
      <PeriodControls
        value={period}
        onChange={(p) => {
          onFilters({ ...filters, period: p, offset: 0 });
        }}
      />
      <QueryNotice
        issue={query.issue}
        loading={query.loading}
        retry={() => {
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
          onFilters({ ...filters, offset: n });
        }}
      />
    </>
  );
}

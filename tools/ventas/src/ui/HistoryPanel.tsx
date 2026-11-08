import { Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type HistoryParams, historyPageSchema } from "../shared/history-contracts.ts";
import { HistoryRow } from "./HistoryRow.tsx";
import { Pager } from "./Pager.tsx";
import { type Period, PeriodControls, periodRange } from "./PeriodControls.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function HistoryPanel({
  kind,
  clientId,
  saleId,
  onSale,
  onReverse,
  ...props
}: ScreenProps & {
  kind: HistoryParams["kind"];
  clientId?: string;
  saleId?: string;
  onSale?: (id: string) => void;
  onReverse?: (id: string) => void;
}) {
  const { t } = useTranslation(),
    [period, setPeriod] = useState<Period>("all"),
    [search, setSearch] = useState("");
  const range = periodRange(props.data.today, period);
  const [offset, setOffset] = useOffset(
    JSON.stringify([kind, clientId, saleId, search, period, props.data.today, props.data.revision]),
  );
  const query = useQuery(
    props.read,
    "history",
    {
      kind,
      clientId,
      saleId,
      offset,
      limit: 20,
      query: search,
      ...range,
      revision: props.data.revision,
    },
    historyPageSchema,
  );
  return (
    <section className="ventas-history-panel">
      <Input
        label={t("searchHistory")}
        value={search}
        maxLength={120}
        onChange={(e) => setSearch(e.target.value.slice(0, 120))}
        type="search"
      />
      <PeriodControls value={period} onChange={setPeriod} />
      <QueryNotice
        issue={query.issue}
        loading={query.loading}
        retry={() => {
          setOffset(0);
          query.retry();
        }}
      />
      {query.value?.rows.map((row) => (
        <HistoryRow
          key={row.data.id}
          row={row}
          onSale={onSale}
          onReverse={onReverse}
          read={props.read}
          revision={props.data.revision}
        />
      ))}
      {query.value && !query.value.rows.length ? <p>{t("emptyMovements")}</p> : null}
      <Pager
        page={query.value}
        offset={offset}
        limit={20}
        loading={query.loading}
        onPage={setOffset}
      />
    </section>
  );
}

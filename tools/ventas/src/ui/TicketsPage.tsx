import { Button, Input } from "@lensdesk/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { historyPageSchema } from "../shared/history-contracts.ts";
import { Choice } from "./Choice.tsx";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { type Period, PeriodControls, periodRange } from "./PeriodControls.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import { SaleDetailView } from "./SaleDetailView.tsx";
import { StatementView } from "./StatementView.tsx";
import type { ScreenProps } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function TicketsPage(props: ScreenProps) {
  const { t, i18n } = useTranslation(),
    [period, setPeriod] = useState<Period>("all"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [clientId, setClientId] = useState(
      props.data.draft.clientId ?? props.data.clients[0]?.id ?? "none",
    );
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
  const saleId = selected ?? query.value?.rows.find((row) => row.kind === "sale")?.data.id;
  return (
    <section className="ventas-tickets">
      <aside className="ventas-ticket-list">
        <h1>{t("nav.tickets")}</h1>
        <Input
          label={t("searchHistory")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value.slice(0, 120));
            setOffset(0);
            setSelected(null);
          }}
          maxLength={120}
          type="search"
        />
        <PeriodControls
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setOffset(0);
            setSelected(null);
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
        {query.value?.rows.map((row) =>
          row.kind === "sale" ? (
            <Button
              key={row.data.id}
              className="ventas-ticket-choice"
              aria-current={saleId === row.data.id ? "true" : undefined}
              onClick={() => setSelected(row.data.id)}
            >
              <strong>{saleFolio(row.data)}</strong>
              <span>
                {row.data.clientId
                  ? row.data.clientName || t("historicalUnavailable")
                  : t("counter")}
              </span>
              <small>
                {dateText(row.data.date, i18n.language)} · {moneyText(row.data.net, i18n.language)}
              </small>
            </Button>
          ) : null,
        )}
        <Pager
          page={query.value}
          offset={offset}
          limit={20}
          loading={query.loading}
          onPage={(n) => {
            setOffset(n);
            setSelected(null);
          }}
        />
      </aside>
      <div className="ventas-ticket-grid">
        <section>
          <h2>{t("saleTicket")}</h2>
          {saleId ? <SaleDetailView {...props} saleId={saleId} /> : <p>{t("noConfirmedSales")}</p>}
        </section>
        <section>
          <h2>{t("statement")}</h2>
          <Choice
            label={t("statementClient")}
            value={clientId}
            onChange={setClientId}
            options={[
              { value: "none", label: t("selectClient") },
              ...props.data.clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {clientId !== "none" ? (
            <StatementView {...props} clientId={clientId} />
          ) : (
            <p>{t("selectClientStatement")}</p>
          )}
        </section>
      </div>
    </section>
  );
}

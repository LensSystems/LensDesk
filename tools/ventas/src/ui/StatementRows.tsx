import { useTranslation } from "react-i18next";
import type { HistoryRow } from "../shared/history-contracts.ts";
import type { SaleRecord } from "../shared/trading-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
export function StatementRows({ sale, summary }: { sale: SaleRecord; summary?: HistoryRow }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <tr>
        <th colSpan={4}>
          {saleFolio(sale)} · {dateText(sale.date, i18n.language)}
          <br />
          {t("dueDate")}: {dateText(sale.due, i18n.language)}
        </th>
      </tr>
      {sale.opening ? (
        <tr>
          <td colSpan={3}>{sale.note}</td>
          <td>{moneyText(sale.total, i18n.language)}</td>
        </tr>
      ) : (
        sale.lines.map((l) => (
          <tr key={l.id}>
            <td>{l.name}</td>
            <td>{l.qty}</td>
            <td>{moneyText(l.price, i18n.language)}</td>
            <td>{moneyText(l.price * l.qty, i18n.language)}</td>
          </tr>
        ))
      )}
      {summary?.kind === "sale" &&
      (summary.data.net !== sale.total || summary.data.pending !== sale.total) ? (
        <tr>
          <td colSpan={4}>
            {t("netAfterReturns")}: {moneyText(summary.data.net, i18n.language)} · {t("pending")}:{" "}
            {moneyText(summary.data.pending, i18n.language)}
          </td>
        </tr>
      ) : null}
    </>
  );
}

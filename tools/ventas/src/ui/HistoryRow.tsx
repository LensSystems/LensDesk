import { Button } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import type { HistoryRow as Row } from "../shared/history-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { ReturnDetailButton } from "./ReturnDetailButton.tsx";
import type { ReadQuery } from "./types.ts";
export function HistoryRow({
  row,
  onSale,
  onReverse,
  read,
  revision,
}: {
  row: Row;
  onSale?: (id: string) => void;
  onReverse?: (id: string) => void;
  read?: ReadQuery;
  revision?: number;
}) {
  const { t, i18n } = useTranslation(),
    money = (n: number) => moneyText(n, i18n.language);
  const date = row.kind === "closing" ? row.data.closedDate : row.data.date;
  let title = "",
    detail = "",
    amount = 0;
  switch (row.kind) {
    case "sale":
      title = `${saleFolio(row.data)} · ${row.data.clientId ? row.data.clientName || t("historicalUnavailable") : t("counter")}`;
      detail = `${t("pending")}: ${money(row.data.pending)} · ${t("dueDate")}: ${dateText(row.data.due, i18n.language)}`;
      amount = row.data.net;
      break;
    case "payment":
      title = row.data.legacyFolio ?? t("paymentFolio", { folio: row.data.folio });
      detail = `${t(row.data.method)} · ${row.data.reference}${row.data.reversal ? ` · ${t("reversedPayment")} (${dateText(row.data.reversal.date, i18n.language)}) · ${row.data.reversal.reason}` : ""}`;
      amount = row.data.applied ?? row.data.amount;
      break;
    case "return":
      title = row.data.legacyFolio ?? t("returnFolio", { folio: row.data.folio });
      detail = `${row.data.reason} · ${t(row.data.restock ? "returnedToStock" : "returnedAsLoss")} · ${t("refund")}: ${money(row.data.refund)}`;
      amount = -row.data.amount;
      break;
    case "inventory":
      title = row.data.productName;
      detail = `${t(`movementKinds.${row.data.kind}`)} · ${row.data.qty} · ${row.data.reason}`;
      amount = row.data.value;
      break;
    case "outflow":
      title = row.data.concept;
      detail = `${t(row.data.kind)} · ${row.data.reference}`;
      amount = -row.data.amount;
      break;
    case "purchase":
      title = row.data.productName;
      detail = `${t("purchase")} · ${row.data.qty} · ${t(row.data.method)}`;
      amount = -row.data.cost;
      break;
    case "closing":
      title = t("cashClosings");
      detail = `${t("difference")}: ${money(row.data.difference)} · ${row.data.reason}`;
      amount = row.data.counted;
      break;
  }
  return (
    <article className="ventas-history-row">
      <div>
        <strong>{title}</strong>
        <small>{dateText(date, i18n.language)}</small>
        <p>{detail}</p>
      </div>
      <strong>{money(amount)}</strong>
      {row.kind === "return" && read && revision !== undefined ? (
        <ReturnDetailButton returnId={row.data.id} read={read} revision={revision} />
      ) : null}
      {row.kind === "sale" && onSale ? (
        <Button onClick={() => onSale(row.data.id)}>{t("viewDetail")}</Button>
      ) : null}
      {row.kind === "payment" &&
      onReverse &&
      !row.data.reversalId &&
      !row.data.opening &&
      row.data.clientId ? (
        <Button onClick={() => onReverse(row.data.id)}>{t("reversePayment")}</Button>
      ) : null}
    </article>
  );
}

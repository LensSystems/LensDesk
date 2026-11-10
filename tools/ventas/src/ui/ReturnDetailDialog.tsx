import { DialogContent, DialogDescription, DialogTitle } from "@lensdesk/ui";
import { useTranslation } from "react-i18next";
import { returnDetailSchema } from "../shared/history-contracts.ts";
import { dateText, moneyText, saleFolio } from "./format.ts";
import { Pager } from "./Pager.tsx";
import { QueryNotice } from "./QueryNotice.tsx";
import type { ReadQuery } from "./types.ts";
import { useOffset } from "./use-offset.ts";
import { useQuery } from "./use-query.ts";
export function ReturnDetailDialog({
  returnId,
  read,
  revision,
}: {
  returnId: string;
  read: ReadQuery;
  revision: number;
}) {
  const { t, i18n } = useTranslation(),
    [offset, setOffset] = useOffset(JSON.stringify([returnId, revision]));
  const q = useQuery(
      read,
      "returnDetail",
      { returnId, revision, offset, limit: 20 },
      returnDetailSchema,
    ),
    d = q.value;
  const money = (n: number) => moneyText(n, i18n.language);
  return (
    <DialogContent className="ventas-detail-dialog">
      <DialogTitle>{t("returnDetail")}</DialogTitle>
      <DialogDescription>{t("returnDetailIntro")}</DialogDescription>
      <QueryNotice
        issue={q.issue}
        loading={q.loading}
        retry={() => {
          setOffset(0);
          q.retry();
        }}
      />
      {d ? (
        <>
          <h3>
            {d.record.legacyFolio ?? t("returnFolio", { folio: d.record.folio })} ·{" "}
            {saleFolio({ folio: d.saleFolio, opening: false, legacyFolio: d.saleLegacyFolio })}
          </h3>
          <p>
            {dateText(d.record.date, i18n.language)} · {d.record.reason}
          </p>
          <p>
            {t("returnDestination")}: {t(d.record.restock ? "returnedToStock" : "returnedAsLoss")}
          </p>
          <p>
            {t("returnAmount")}: {money(d.record.amount)} · {t("cost")}: {money(d.record.cost)} ·{" "}
            {t("refund")}: {money(d.record.refund)}
          </p>
          <div className="ventas-paper ventas-return-lines">
            <table>
              <thead>
                <tr>
                  {["product", "quantity", "amount", "cost"].map((k) => (
                    <th key={k}>{t(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.lines.rows.map((l) => (
                  <tr key={l.id}>
                    <th scope="row">{l.name}</th>
                    <td>{l.qty}</td>
                    <td>{money(l.amount)}</td>
                    <td>{money(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={d.lines} offset={offset} limit={20} loading={q.loading} onPage={setOffset} />
        </>
      ) : null}
    </DialogContent>
  );
}

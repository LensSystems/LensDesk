import { Button } from "@lensdesk/ui";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CashPanel } from "./CashPanel.tsx";
import { Choice } from "./Choice.tsx";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { OutflowDialog } from "./OutflowDialog.tsx";
import { RecentMovements } from "./RecentMovements.tsx";
import { StockDialog } from "./StockDialog.tsx";
import type { ScreenProps } from "./types.ts";
import { useDialogReturnFocus } from "./use-dialog-return-focus.ts";
export function ExpensesPage(props: ScreenProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<
    "outflows" | "purchases" | "closings" | "returns" | "none"
  >("none");
  const [dialog, setDialog] = useState<"receive" | "expense" | "withdrawal" | null>(null);
  const root = useRef<HTMLElement>(null);
  const returnFocus = useDialogReturnFocus(root, props.busy, props.operation);
  const onCloseAutoFocus = (event: Event) =>
    returnFocus(event, `[data-expense-action="${dialog}"]`);
  return (
    <section ref={root} className="ventas-expenses-workspace">
      <aside className="ventas-expenses-sidebar">
        <div>
          <h1 className="ventas-page-title">{t("expensesTitle")}</h1>
          <p className="text-muted">{t("expensesIntro")}</p>
        </div>
        <section className="ventas-expense-panel">
          <h2>{t("recordMovement")}</h2>
          <p className="text-muted">{t("expenseMovementIntro")}</p>
          <Button
            data-expense-action="expense"
            variant="primary"
            disabled={props.busy}
            onClick={() => setDialog("expense")}
          >
            {t("recordExpense")}
          </Button>
          <Button
            data-expense-action="receive"
            disabled={props.busy}
            onClick={() => setDialog("receive")}
          >
            {t("buyGoods")}
          </Button>
          <Button
            data-expense-action="withdrawal"
            disabled={props.busy}
            onClick={() => setDialog("withdrawal")}
          >
            {t("recordWithdrawal")}
          </Button>
        </section>
        <CashPanel data={props.data} busy={props.busy} />
      </aside>
      <section className="ventas-expenses-movements" aria-label={t("movements")}>
        <RecentMovements data={props.data} />
        <Choice
          label={t("fullHistory")}
          value={history}
          onChange={(v) => setHistory(v as typeof history)}
          options={[
            { value: "none", label: t("hideHistory") },
            ...(["outflows", "purchases", "closings", "returns"] as const).map((value) => ({
              value,
              label: t(`historyKinds.${value}`),
            })),
          ]}
        />
        {history !== "none" ? <HistoryPanel {...props} kind={history} /> : null}
      </section>
      {dialog === "receive" ? (
        <StockDialog
          {...props}
          onCloseAutoFocus={onCloseAutoFocus}
          mode="receive"
          close={() => setDialog(null)}
        />
      ) : dialog ? (
        <OutflowDialog
          {...props}
          onCloseAutoFocus={onCloseAutoFocus}
          kind={dialog}
          close={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

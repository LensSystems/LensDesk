import { Button } from "@lensdesk/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PaymentInput } from "../shared/trading-contracts.ts";
import { defaultBank } from "../shared/values.ts";
import { CheckoutPage } from "./CheckoutPage.tsx";
import { Choice } from "./Choice.tsx";
import { ConfirmSaleDialog } from "./ConfirmSaleDialog.tsx";
import { cartTotal } from "./cart.ts";
import { DraftTicket } from "./DraftTicket.tsx";
import { newPayment, paymentValue } from "./PaymentFields.tsx";
import { SaleDetailView } from "./SaleDetailView.tsx";
import { StatementView } from "./StatementView.tsx";
import { TicketList } from "./TicketList.tsx";
import type { WorkspaceProps } from "./ticket-workspace.ts";
import type { ScreenProps } from "./types.ts";
import { useDialogReturnFocus } from "./use-dialog-return-focus.ts";

export function TicketWorkspaceView({
  workspace,
  onWorkspace,
  onBack,
  focusRequested,
  onFocused,
  ...props
}: ScreenProps &
  WorkspaceProps & { onBack: () => void; focusRequested?: boolean; onFocused?: () => void }) {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const returnFocus = useDialogReturnFocus(root, props.busy, props.operation);
  const confirmed = useRef(false);
  const [confirmation, setConfirmation] = useState<{ total: number; payment: PaymentInput } | null>(
    null,
  );
  const statementHeading = useRef<HTMLHeadingElement>(null);
  const saleHeading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef(Boolean(workspace.selected));
  const total = cartTotal(props.data);
  const hasDraft = props.data.draft.lines.length > 0;
  const value = workspace.payment ?? newPayment(total ?? 0, defaultBank(props.data.settings));
  const clientId = workspace.clientId;
  const previewDraft = hasDraft && !workspace.review;
  useEffect(() => {
    if (!workspace.initialized || (!workspace.payment && hasDraft && !props.busy))
      onWorkspace({
        ...workspace,
        initialized: true,
        clientId: workspace.initialized
          ? workspace.clientId
          : (workspace.clientId ?? props.data.draft.clientId ?? props.data.clients[0]?.id ?? null),
        bankId: workspace.initialized ? workspace.bankId : defaultBank(props.data.settings),
        payment: hasDraft && !props.busy ? value : workspace.payment,
      });
  }, [workspace, hasDraft, props.busy, props.data, onWorkspace, value]);
  useLayoutEffect(() => {
    if (focusRequested) {
      statementHeading.current?.focus();
      onFocused?.();
    }
  }, [focusRequested, onFocused]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    if (props.busy) {
      if (props.operation.issue && !props.operation.writing && !props.operation.loading)
        root.current
          ?.closest(".ventas-app")
          ?.querySelector<HTMLButtonElement>(':scope > div > [role="alert"] button:not([disabled])')
          ?.focus();
      else if (!document.querySelector('[role="dialog"]')) saleHeading.current?.focus();
      return;
    }
    saleHeading.current?.focus();
    pendingFocus.current = false;
  }, [props.busy, props.operation.issue, props.operation.writing, props.operation.loading]);
  const select = (selected: string | null) =>
    onWorkspace({ ...workspace, selected, review: Boolean(selected), autoSelect: false });
  return (
    <section className="ventas-tickets" ref={root}>
      <aside className="ventas-ticket-list">
        <div>
          <h1 className="ventas-page-title">{t("checkoutWorkspace")}</h1>
          <p className="ventas-checkout-note">
            {hasDraft
              ? (props.data.clients.find((c) => c.id === props.data.draft.clientId)?.name ??
                t("counter"))
              : t("confirmedSales")}
          </p>
        </div>
        {hasDraft && total !== null ? (
          <CheckoutPage
            {...props}
            total={total}
            value={value}
            onChange={(payment) => onWorkspace({ ...workspace, payment })}
            onBack={onBack}
            onConfirm={() => {
              confirmed.current = false;
              setConfirmation({ total, payment: paymentValue(value, true) });
            }}
          />
        ) : (
          <>
            {hasDraft ? (
              <p role="alert">{t("amountLimit")}</p>
            ) : (
              <p className="ventas-checkout-note">{t("chooseTicketHint")}</p>
            )}
            <Button variant="primary" onClick={onBack} disabled={props.operation.writing}>
              {t("newSale")}
            </Button>
          </>
        )}
        <hr className="ventas-checkout-divider" />
        <TicketList
          {...props}
          autoSelect={!hasDraft && workspace.autoSelect}
          filters={workspace.query}
          onFilters={(query) => onWorkspace({ ...workspace, query })}
          selected={workspace.selected}
          onSelect={select}
        />
      </aside>
      <section className="ventas-ticket-grid" aria-label={t("ticketPreview")}>
        <section>
          <h2 ref={saleHeading} data-sale-ticket-heading tabIndex={-1}>
            {t(previewDraft ? "draftTicket" : "saleTicket")}
          </h2>
          {previewDraft && total !== null ? (
            <DraftTicket {...props} total={total} payment={paymentValue(value, true)} />
          ) : workspace.selected ? (
            <SaleDetailView {...props} saleId={workspace.selected} />
          ) : (
            <p>{t("selectConfirmedSale")}</p>
          )}
          {hasDraft && workspace.review ? (
            <Button onClick={() => onWorkspace({ ...workspace, review: false })}>
              {t("viewDraft")}
            </Button>
          ) : null}
        </section>
        <section>
          <h2 ref={statementHeading} tabIndex={-1}>
            {t("statement")}
          </h2>
          <Choice
            label={t("statementClient")}
            value={clientId ?? "none"}
            onChange={(id) => onWorkspace({ ...workspace, clientId: id === "none" ? null : id })}
            options={[
              { value: "none", label: t("selectClient") },
              ...props.data.clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {clientId ? (
            <StatementView
              {...props}
              clientId={clientId}
              bankId={workspace.bankId}
              onBank={(bankId) => onWorkspace({ ...workspace, bankId })}
            />
          ) : (
            <p>{t("selectClientStatement")}</p>
          )}
        </section>
      </section>
      {confirmation ? (
        <ConfirmSaleDialog
          {...props}
          {...confirmation}
          close={() => setConfirmation(null)}
          onCloseAutoFocus={(event) =>
            returnFocus(
              event,
              confirmed.current ? "[data-sale-ticket-heading]" : "[data-checkout-confirm]",
            )
          }
          onSaved={(selected) => {
            confirmed.current = true;
            pendingFocus.current = true;
            onWorkspace({ ...workspace, selected, review: true, payment: null });
          }}
        />
      ) : null}
    </section>
  );
}

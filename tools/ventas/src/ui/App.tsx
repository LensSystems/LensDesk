import {
  applyDocumentContext,
  Dialog,
  Notice,
  Tabs,
  TabsContent,
  TooltipProvider,
  UiLabelsProvider,
} from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountsPage } from "./AccountsPage.tsx";
import type { AccountsState } from "./account-status.ts";
import { CashDialog } from "./CashDialog.tsx";
import { ExpensesPage } from "./ExpensesPage.tsx";
import { Inventory } from "./Inventory.tsx";
import { Navigation } from "./Navigation.tsx";
import type { Period } from "./PeriodControls.tsx";
import { Sale } from "./Sale.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { SummaryPage } from "./SummaryPage.tsx";
import { TicketsPage } from "./TicketsPage.tsx";
import type { Client, Screen } from "./types.ts";
import { useSales } from "./use-sales.ts";

export function App({ client }: { client: Client }) {
  const { t, i18n } = useTranslation();
  const language = useRef(i18n);
  language.current = i18n;
  const [screen, setScreen] = useState<Screen>("sale");
  const sales = useSales(client);
  const [accountsState, setAccountsState] = useState<AccountsState>({
    selected: null,
    query: "",
    filter: "all",
  });
  const [summaryPeriod, setSummaryPeriod] = useState<Period>("today");
  const [accountFocus, setAccountFocus] = useState(false);
  const [statementFocus, setStatementFocus] = useState(false);
  const [statementClient, setStatementClient] = useState<string | undefined>();
  const openAccount = (selected: string | null) => {
    setAccountFocus(true);
    setAccountsState((state) => ({ ...state, selected }));
    setScreen("accounts");
  };
  const [cashOpen, setCashOpen] = useState(false);
  const restoreSeen = useRef<string | null>(null);
  useEffect(() => {
    if (!sales.restoredId || restoreSeen.current === sales.restoredId) return;
    restoreSeen.current = sales.restoredId;
    const first = sales.data?.clients[0]?.id;
    setAccountsState((state) => ({ ...state, selected: first ?? null }));
    setStatementClient(first);
  }, [sales.restoredId, sales.data?.clients]);
  useEffect(() => {
    let alive = true;
    let receivedEvent = false;
    const apply = (context: Parameters<typeof applyDocumentContext>[0]) => {
      if (!alive) return;
      applyDocumentContext(context);
      void language.current.changeLanguage(context.locale);
    };
    void client.app
      .getContext()
      .then((context) => {
        if (!receivedEvent) apply(context);
      })
      .catch(() => undefined);
    const unsubscribe = client.app.onContextChange((context) => {
      receivedEvent = true;
      apply(context);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [client]);
  useEffect(() => {
    document.title = t("title");
  }, [t]);
  const props = sales.data
    ? {
        data: sales.data,
        run: sales.run,
        busy: sales.busy,
        operation: sales,
        read: client.backend.invoke,
      }
    : null;
  return (
    <UiLabelsProvider labels={{ close: t("close"), dismiss: t("close"), loading: t("loading") }}>
      <TooltipProvider>
        <Dialog
          open={cashOpen}
          onOpenChange={(open) => {
            if (!open && sales.writing) return;
            setCashOpen(open);
          }}
        >
          <Tabs value={screen} onValueChange={(value) => setScreen(value as Screen)} asChild>
            <main className="ventas-app">
              <Navigation data={sales.data} busy={sales.busy} />
              {sales.issue ? (
                <div className="p-3">
                  <Notice
                    tone="danger"
                    title={t(`errors.${sales.issue}`, { defaultValue: t("errors.E_INTERNAL") })}
                    action={
                      !sales.loading
                        ? {
                            label: t(sales.pendingConfirmation ? "retryOperation" : "retry"),
                            onClick: sales.retry,
                          }
                        : undefined
                    }
                  />
                </div>
              ) : null}
              <TabsContent value={screen} className="ventas-content">
                {!props ? (
                  sales.loading ? (
                    <p role="status" className="p-6">
                      {t("loading")}
                    </p>
                  ) : null
                ) : screen === "inventory" ? (
                  <Inventory {...props} />
                ) : screen === "accounts" ? (
                  <AccountsPage
                    {...props}
                    focusRequested={accountFocus}
                    onFocused={() => setAccountFocus(false)}
                    state={accountsState}
                    onState={setAccountsState}
                    onSale={() => setScreen("sale")}
                    onStatement={(id) => {
                      setStatementClient(id);
                      setStatementFocus(true);
                      setScreen("tickets");
                    }}
                  />
                ) : screen === "expenses" ? (
                  <ExpensesPage {...props} />
                ) : screen === "tickets" ? (
                  <TicketsPage
                    {...props}
                    initialClientId={statementClient}
                    focusRequested={statementFocus}
                    onFocused={() => setStatementFocus(false)}
                  />
                ) : screen === "summary" ? (
                  <SummaryPage
                    {...props}
                    period={summaryPeriod}
                    onPeriod={setSummaryPeriod}
                    onAccount={openAccount}
                  />
                ) : screen === "settings" ? (
                  <SettingsPage
                    {...props}
                    client={client}
                    restore={sales.restore}
                    restoredId={sales.restoredId}
                  />
                ) : screen === "sale" ? (
                  <Sale
                    {...props}
                    onInventory={() => setScreen("inventory")}
                    onAccounts={() => openAccount(props.data.draft.clientId)}
                  />
                ) : null}
              </TabsContent>
              {cashOpen && props ? (
                <CashDialog {...props} managedDialog close={() => setCashOpen(false)} />
              ) : null}
            </main>
          </Tabs>
        </Dialog>
      </TooltipProvider>
    </UiLabelsProvider>
  );
}

import {
  applyDocumentContext,
  Button,
  Notice,
  TooltipProvider,
  UiLabelsProvider,
} from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountsPage } from "./AccountsPage.tsx";
import { CashDialog } from "./CashDialog.tsx";
import { ExpensesPage } from "./ExpensesPage.tsx";
import { dateText } from "./format.ts";
import { Inventory } from "./Inventory.tsx";
import { Sale } from "./Sale.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { SummaryPage } from "./SummaryPage.tsx";
import { TicketsPage } from "./TicketsPage.tsx";
import { type Client, type Screen, screens } from "./types.ts";
import { useSales } from "./use-sales.ts";

export function App({ client }: { client: Client }) {
  const { t, i18n } = useTranslation();
  const language = useRef(i18n);
  language.current = i18n;
  const [screen, setScreen] = useState<Screen>("sale");
  const sales = useSales(client);
  const [cashOpen, setCashOpen] = useState(false);
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
        <main className="ventas-app">
          <header className="ventas-nav">
            <nav aria-label={t("navigation")}>
              {screens.map((key) => (
                <Button
                  key={key}
                  variant={screen === key ? "default" : "ghost"}
                  aria-current={screen === key ? "page" : undefined}
                  onClick={() => setScreen(key)}
                >
                  {t(`nav.${key}`)}
                </Button>
              ))}
            </nav>
            <div className="ventas-nav-status">
              <span>{sales.data ? dateText(sales.data.today, i18n.language) : ""}</span>
              <Button disabled={sales.busy || !sales.data} onClick={() => setCashOpen(true)}>
                {t(sales.data?.cash ? "cashOpen" : "openCash")}
              </Button>
            </div>
          </header>
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
          {!props ? (
            sales.loading ? (
              <p role="status" className="p-6">
                {t("loading")}
              </p>
            ) : null
          ) : screen === "inventory" ? (
            <Inventory {...props} />
          ) : screen === "accounts" ? (
            <AccountsPage {...props} onSale={() => setScreen("sale")} />
          ) : screen === "expenses" ? (
            <ExpensesPage {...props} />
          ) : screen === "tickets" ? (
            <TicketsPage {...props} />
          ) : screen === "summary" ? (
            <SummaryPage {...props} />
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
              onAccounts={() => setScreen("accounts")}
            />
          ) : null}
          {cashOpen && props ? <CashDialog {...props} close={() => setCashOpen(false)} /> : null}
        </main>
      </TooltipProvider>
    </UiLabelsProvider>
  );
}

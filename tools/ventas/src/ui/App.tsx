import { applyDocumentContext, Button, Notice, UiLabelsProvider } from "@lensdesk/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Inventory } from "./Inventory.tsx";
import { Sale } from "./Sale.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { type Client, type Screen, screens } from "./types.ts";
import { useSales } from "./use-sales.ts";

export function App({ client }: { client: Client }) {
  const { t, i18n } = useTranslation();
  const language = useRef(i18n);
  language.current = i18n;
  const [screen, setScreen] = useState<Screen>("sale");
  const sales = useSales(client);
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
    ? { data: sales.data, run: sales.run, busy: sales.busy, operation: sales }
    : null;
  return (
    <UiLabelsProvider labels={{ close: t("close"), dismiss: t("close"), loading: t("loading") }}>
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
          <span className="text-muted text-xs">{t("local")}</span>
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
        ) : screen === "settings" ? (
          <SettingsPage {...props} />
        ) : screen === "sale" ? (
          <Sale {...props} onInventory={() => setScreen("inventory")} />
        ) : (
          <section className="ventas-empty">
            <h1>{t(`nav.${screen}`)}</h1>
            <p>{t("emptyMovements")}</p>
          </section>
        )}
      </main>
    </UiLabelsProvider>
  );
}

import type { createToolClient } from "@lensdesk/sdk";
import { applyDocumentContext, type DocumentContext } from "@lensdesk/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

type Client = ReturnType<typeof createToolClient>;

// Aplica tema e idioma del host, también cuando cambian en vivo.
export function useAppContext(client: Client) {
  const { i18n } = useTranslation();
  useEffect(() => {
    let alive = true;
    const applyContext = (context: DocumentContext) => {
      applyDocumentContext(context);
      void i18n.changeLanguage(context.locale);
    };
    void client.app
      .getContext()
      .then((context) => {
        if (alive) applyContext(context);
      })
      .catch(() => undefined);
    const unsubscribe = client.app.onContextChange(applyContext);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [client, i18n]);
}
